import Docker from "dockerode";
import type { Tenant, TenantConfig } from "../db/schema.js";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// Default Medusa image - can be overridden per tenant
const DEFAULT_MEDUSA_IMAGE =
	process.env.DEFAULT_MEDUSA_IMAGE || "ghcr.io/leconome/medusa:latest";
const POSTGRES_IMAGE = "postgres:15-alpine";
const REDIS_IMAGE = "redis:7-alpine";

// Domain configuration
const DOMAIN = process.env.DOMAIN || "localhost";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface ServiceInfo {
	serviceId: string;
	serviceName: string;
	status: string;
	replicas: { running: number; desired: number };
}

export interface TenantServices {
	network: { networkId: string; networkName: string };
	postgres: ServiceInfo;
	redis: ServiceInfo;
	medusa: ServiceInfo;
}

function getNetworkName(tenant: Tenant): string {
	return `tenant_${tenant.slug}_network`;
}

function getServiceName(tenant: Tenant, service: string): string {
	return `tenant_${tenant.slug}_${service}`;
}

/**
 * Create an overlay network for the tenant
 */
export async function createTenantNetwork(tenant: Tenant): Promise<string> {
	const networkName = getNetworkName(tenant);

	// Check if network already exists
	const networks = await docker.listNetworks({
		filters: { name: [networkName] },
	});

	if (networks.length > 0) {
		return networks[0].Id;
	}

	const network = await docker.createNetwork({
		Name: networkName,
		Driver: "overlay",
		Attachable: true,
		Labels: {
			"econome.tenant.id": tenant.id,
			"econome.tenant.slug": tenant.slug,
		},
	});

	return network.id;
}

/**
 * Get existing service by name
 */
async function getExistingService(
	serviceName: string,
): Promise<Docker.Service | null> {
	const services = await docker.listServices({
		filters: { name: [serviceName] },
	});

	// Exact match
	const service = services.find((s) => s.Spec?.Name === serviceName);
	return service ? docker.getService(service.ID) : null;
}

/**
 * Get service status
 */
async function getServiceStatus(
	serviceName: string,
): Promise<{ status: string; running: number; desired: number }> {
	try {
		const services = await docker.listServices({
			filters: { name: [serviceName] },
		});

		const service = services.find((s) => s.Spec?.Name === serviceName);
		if (!service) {
			return { status: "not_found", running: 0, desired: 0 };
		}

		const tasks = await docker.listTasks({
			filters: { service: [serviceName] },
		});

		const runningTasks = tasks.filter(
			(t) => t.Status?.State === "running",
		).length;
		const desiredReplicas = service.Spec?.Mode?.Replicated?.Replicas || 1;

		let status = "unknown";
		if (runningTasks === 0) {
			status = "stopped";
		} else if (runningTasks < desiredReplicas) {
			status = "starting";
		} else {
			status = "running";
		}

		return { status, running: runningTasks, desired: desiredReplicas };
	} catch {
		return { status: "not_found", running: 0, desired: 0 };
	}
}

/**
 * Create PostgreSQL service for tenant
 */
export async function createPostgresService(
	tenant: Tenant,
	networkName: string,
): Promise<ServiceInfo> {
	const serviceName = getServiceName(tenant, "postgres");

	// Check if service already exists
	const existing = await getExistingService(serviceName);
	if (existing) {
		const status = await getServiceStatus(serviceName);
		return {
			serviceId: (await existing.inspect()).ID,
			serviceName,
			status: status.status,
			replicas: { running: status.running, desired: status.desired },
		};
	}

	const dbName = `medusa_${tenant.slug}`;
	const dbUser = `medusa_${tenant.slug}`;
	const dbPassword = generatePassword();
	const volumeName = `tenant_${tenant.slug}_postgres_data`;

	await docker.createService({
		Name: serviceName,
		Labels: {
			"econome.tenant.id": tenant.id,
			"econome.tenant.slug": tenant.slug,
			"econome.service": "postgres",
			"econome.db.name": dbName,
			"econome.db.user": dbUser,
			"econome.db.password": dbPassword,
		},
		TaskTemplate: {
			ContainerSpec: {
				Image: POSTGRES_IMAGE,
				Env: [
					`POSTGRES_DB=${dbName}`,
					`POSTGRES_USER=${dbUser}`,
					`POSTGRES_PASSWORD=${dbPassword}`,
					`PGDATA=/var/lib/postgresql/data/pgdata`,
				],
				Mounts: [
					{
						Type: "volume",
						Source: volumeName,
						Target: "/var/lib/postgresql/data",
					},
				],
				HealthCheck: {
					Test: ["CMD-SHELL", `pg_isready -U ${dbUser} -d ${dbName}`],
					Interval: 5000000000,
					Timeout: 5000000000,
					Retries: 5,
				},
			},
			Networks: [{ Target: networkName }],
			RestartPolicy: {
				Condition: "on-failure",
				Delay: 5000000000,
				MaxAttempts: 3,
			},
		},
		Mode: { Replicated: { Replicas: 1 } },
	});

	// Get the created service to retrieve its ID
	const createdService = await getExistingService(serviceName);
	const serviceId = createdService
		? (await createdService.inspect()).ID
		: serviceName;

	return {
		serviceId,
		serviceName,
		status: "starting",
		replicas: { running: 0, desired: 1 },
	};
}

/**
 * Create Redis service for tenant
 */
export async function createRedisService(
	tenant: Tenant,
	networkName: string,
): Promise<ServiceInfo> {
	const serviceName = getServiceName(tenant, "redis");

	// Check if service already exists
	const existing = await getExistingService(serviceName);
	if (existing) {
		const status = await getServiceStatus(serviceName);
		return {
			serviceId: (await existing.inspect()).ID,
			serviceName,
			status: status.status,
			replicas: { running: status.running, desired: status.desired },
		};
	}

	const volumeName = `tenant_${tenant.slug}_redis_data`;

	await docker.createService({
		Name: serviceName,
		Labels: {
			"econome.tenant.id": tenant.id,
			"econome.tenant.slug": tenant.slug,
			"econome.service": "redis",
		},
		TaskTemplate: {
			ContainerSpec: {
				Image: REDIS_IMAGE,
				Args: [
					"redis-server",
					"--appendonly",
					"yes",
					"--appendfsync",
					"everysec",
				],
				Mounts: [
					{
						Type: "volume",
						Source: volumeName,
						Target: "/data",
					},
				],
				HealthCheck: {
					Test: ["CMD", "redis-cli", "ping"],
					Interval: 5000000000,
					Timeout: 5000000000,
					Retries: 5,
				},
			},
			Networks: [{ Target: networkName }],
			RestartPolicy: {
				Condition: "on-failure",
				Delay: 5000000000,
				MaxAttempts: 3,
			},
		},
		Mode: { Replicated: { Replicas: 1 } },
	});

	// Get the created service to retrieve its ID
	const createdService = await getExistingService(serviceName);
	const serviceId = createdService
		? (await createdService.inspect()).ID
		: serviceName;

	return {
		serviceId,
		serviceName,
		status: "starting",
		replicas: { running: 0, desired: 1 },
	};
}

/**
 * Create Medusa service for tenant
 */
export async function createMedusaService(
	tenant: Tenant,
	networkName: string,
	_postgresService: ServiceInfo,
	_redisService: ServiceInfo,
	imageTag?: string,
): Promise<ServiceInfo> {
	const image = imageTag || DEFAULT_MEDUSA_IMAGE;
	const serviceName = getServiceName(tenant, "medusa");

	// Check if service already exists
	const existing = await getExistingService(serviceName);
	if (existing) {
		const status = await getServiceStatus(serviceName);
		return {
			serviceId: (await existing.inspect()).ID,
			serviceName,
			status: status.status,
			replicas: { running: status.running, desired: status.desired },
		};
	}

	const postgresName = getServiceName(tenant, "postgres");
	const redisName = getServiceName(tenant, "redis");

	// Get postgres credentials from service labels
	const postgresServiceObj = await getExistingService(postgresName);
	if (!postgresServiceObj) {
		throw new Error("PostgreSQL service not found");
	}
	const postgresInspect = await postgresServiceObj.inspect();
	const labels = postgresInspect.Spec?.Labels || {};

	const dbName = labels["econome.db.name"];
	const dbUser = labels["econome.db.user"];
	const dbPassword = labels["econome.db.password"];

	const databaseUrl = `postgres://${dbUser}:${dbPassword}@${postgresName}:5432/${dbName}?sslmode=disable`;
	const redisUrl = `redis://${redisName}:6379`;

	const config = tenant.config as TenantConfig;
	const protocol = IS_PRODUCTION ? "https" : "http";
	const tenantUrl = `${protocol}://${tenant.subdomain}.${DOMAIN}`;
	const defaultStoreCors = config.storeCors || tenantUrl;
	const defaultAdminCors = config.adminCors || tenantUrl;
	const defaultAuthCors = tenantUrl;

	await docker.createService({
		Name: serviceName,
		Labels: {
			"econome.tenant.id": tenant.id,
			"econome.tenant.slug": tenant.slug,
			"econome.service": "medusa",
			// Traefik labels for Swarm
			"traefik.enable": "true",
			"traefik.docker.network": "platform_network",
			[`traefik.http.routers.${tenant.slug}.rule`]: `Host(\`${tenant.subdomain}.${DOMAIN}\`)`,
			[`traefik.http.routers.${tenant.slug}.entrypoints`]: IS_PRODUCTION
				? "websecure"
				: "web",
			...(IS_PRODUCTION && {
				[`traefik.http.routers.${tenant.slug}.tls`]: "true",
				[`traefik.http.routers.${tenant.slug}.tls.certresolver`]: "letsencrypt",
				[`traefik.http.routers.${tenant.slug}.middlewares`]:
					"tenant-cors@file,security-headers@file",
			}),
			[`traefik.http.routers.${tenant.slug}.service`]: tenant.slug,
			[`traefik.http.services.${tenant.slug}.loadbalancer.server.port`]: "9000",
		},
		TaskTemplate: {
			ContainerSpec: {
				Image: image,
				Env: [
					`DATABASE_URL=${databaseUrl}`,
					`REDIS_URL=${redisUrl}`,
					`CACHE_REDIS_URL=${redisUrl}`,
					`JWT_SECRET=${generateSecret()}`,
					`COOKIE_SECRET=${generateSecret()}`,
					`STORE_CORS=${defaultStoreCors}`,
					`ADMIN_CORS=${defaultAdminCors}`,
					`AUTH_CORS=${defaultAuthCors}`,
					`MEDUSA_BACKEND_URL=${tenantUrl}`,
					`MEDUSA_ADMIN_ONBOARDING_TYPE=default`,
					`ADMIN_EMAIL=${tenant.adminEmail || "admin@example.com"}`,
					`ADMIN_PASSWORD=${tenant.adminPassword || "admin123"}`,
					`NODE_ENV=${IS_PRODUCTION ? "production" : "development"}`,
				],
				HealthCheck: {
					Test: ["CMD", "curl", "-f", "http://localhost:9000/health"],
					Interval: 10000000000,
					Timeout: 10000000000,
					Retries: 10,
					StartPeriod: 60000000000,
				},
			},
			Networks: [{ Target: networkName }, { Target: "platform_network" }],
			RestartPolicy: {
				Condition: "on-failure",
				Delay: 5000000000,
				MaxAttempts: 5,
			},
		},
		Mode: { Replicated: { Replicas: 1 } },
		UpdateConfig: {
			Parallelism: 1,
			Order: "start-first", // Zero-downtime updates!
			FailureAction: "rollback",
			Delay: 10000000000,
		},
		RollbackConfig: {
			Parallelism: 1,
			Order: "start-first",
			Delay: 10000000000,
		},
	});

	// Get the created service to retrieve its ID
	const createdService = await getExistingService(serviceName);
	const serviceId = createdService
		? (await createdService.inspect()).ID
		: serviceName;

	return {
		serviceId,
		serviceName,
		status: "starting",
		replicas: { running: 0, desired: 1 },
	};
}

/**
 * Update a service to a new image (zero-downtime)
 */
export async function updateServiceImage(
	serviceName: string,
	newImage: string,
): Promise<void> {
	const service = await getExistingService(serviceName);
	if (!service) {
		throw new Error(`Service ${serviceName} not found`);
	}

	const spec = (await service.inspect()).Spec;
	if (!spec) {
		throw new Error(`Service ${serviceName} has no spec`);
	}

	// Update the image
	spec.TaskTemplate?.ContainerSpec!.Image = newImage;

	// Force update by incrementing version
	const version = (await service.inspect()).Version?.Index;

	await service.update({
		version: version,
		...spec,
	});
}

/**
 * Scale a service (set replicas to 0 to stop, 1 to start)
 */
export async function scaleService(
	serviceName: string,
	replicas: number,
): Promise<void> {
	const service = await getExistingService(serviceName);
	if (!service) {
		throw new Error(`Service ${serviceName} not found`);
	}

	const inspect = await service.inspect();
	const spec = inspect.Spec;
	if (!spec) {
		throw new Error(`Service ${serviceName} has no spec`);
	}

	spec.Mode = { Replicated: { Replicas: replicas } };

	await service.update({
		version: inspect.Version?.Index,
		...spec,
	});
}

/**
 * Remove a service
 */
export async function removeService(serviceName: string): Promise<void> {
	const service = await getExistingService(serviceName);
	if (service) {
		await service.remove();
	}
}

/**
 * Remove network
 */
export async function removeNetwork(networkName: string): Promise<void> {
	try {
		const network = docker.getNetwork(networkName);
		await network.remove();
	} catch {
		// Network might not exist
	}
}

/**
 * Get service logs
 */
export async function getServiceLogs(
	serviceName: string,
	tail: number = 100,
): Promise<string> {
	const service = await getExistingService(serviceName);
	if (!service) {
		throw new Error(`Service ${serviceName} not found`);
	}

	// Get tasks for this service and retrieve logs from the container
	const tasks = await docker.listTasks({
		filters: { service: [serviceName] },
	});

	if (tasks.length === 0) {
		return "No tasks found for service";
	}

	// Get the most recent task's container
	const runningTask = tasks.find((t) => t.Status?.State === "running");
	if (!runningTask || !runningTask.Status?.ContainerStatus?.ContainerID) {
		return "No running container found for service";
	}

	const container = docker.getContainer(
		runningTask.Status.ContainerStatus.ContainerID,
	);
	const logs = await container.logs({
		stdout: true,
		stderr: true,
		tail,
		timestamps: true,
	});

	return logs.toString("utf-8");
}

/**
 * Wait for service to be healthy
 */
export async function waitForServiceHealthy(
	serviceName: string,
	timeoutMs: number = 120000,
): Promise<boolean> {
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const status = await getServiceStatus(serviceName);

		if (status.status === "running" && status.running >= status.desired) {
			return true;
		}

		await sleep(2000);
	}

	return false;
}

/**
 * List all services for a tenant
 */
export async function listTenantServices(
	tenantId: string,
): Promise<Docker.Service[]> {
	return docker.listServices({
		filters: {
			label: [`econome.tenant.id=${tenantId}`],
		},
	});
}

/**
 * Check if running in Swarm mode
 */
export async function isSwarmMode(): Promise<boolean> {
	try {
		const info = await docker.info();
		return info.Swarm?.LocalNodeState === "active";
	} catch {
		return false;
	}
}

// Utility functions
function generatePassword(length: number = 24): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function generateSecret(length: number = 32): string {
	return generatePassword(length);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pull an image
 */
export async function pullImage(imageTag: string): Promise<void> {
	console.log(`Pulling image: ${imageTag}`);

	return new Promise((resolve, reject) => {
		docker.pull(
			imageTag,
			(err: Error | null, stream: NodeJS.ReadableStream) => {
				if (err) {
					console.error(`Failed to pull image ${imageTag}:`, err);
					reject(err);
					return;
				}

				docker.modem.followProgress(
					stream,
					(err: Error | null) => {
						if (err) {
							console.error(`Error during image pull ${imageTag}:`, err);
							reject(err);
							return;
						}
						console.log(`Successfully pulled image: ${imageTag}`);
						resolve();
					},
					(event: { status?: string; progress?: string }) => {
						if (event.status) {
							const progress = event.progress ? ` ${event.progress}` : "";
							console.log(`  ${event.status}${progress}`);
						}
					},
				);
			},
		);
	});
}

/**
 * Check if image exists
 */
export async function imageExists(imageTag: string): Promise<boolean> {
	try {
		const image = docker.getImage(imageTag);
		await image.inspect();
		return true;
	} catch {
		return false;
	}
}

export { docker, getServiceStatus };
