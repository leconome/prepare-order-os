import Docker from "dockerode";
import type { Tenant, TenantConfig } from "../db/schema.js";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

// Default images - can be overridden per tenant
const DEFAULT_MEDUSA_IMAGE =
  process.env.DEFAULT_MEDUSA_IMAGE || "ghcr.io/leconome/medusa:latest";
const DEFAULT_CLIENT_IMAGE =
  process.env.DEFAULT_CLIENT_IMAGE || "ghcr.io/leconome/client:latest";
const POSTGRES_IMAGE = "postgres:15-alpine";
const REDIS_IMAGE = "redis:7-alpine";

// Domain configuration - defaults to localhost for development
const DOMAIN = process.env.DOMAIN || "localhost";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

export interface ContainerInfo {
  containerId: string;
  containerName: string;
  status: string;
  port?: number;
}

export interface TenantContainers {
  network: { networkId: string; networkName: string };
  postgres: ContainerInfo;
  redis: ContainerInfo;
  medusa: ContainerInfo;
}

function getNetworkName(tenant: Tenant): string {
  return `tenant_${tenant.slug}_network`;
}

function getContainerName(tenant: Tenant, service: string): string {
  return `tenant_${tenant.slug}_${service}`;
}

// Check if a container with the given name already exists
async function getExistingContainer(containerName: string): Promise<Docker.ContainerInfo | null> {
  const containers = await docker.listContainers({
    all: true,
    filters: { name: [`^/${containerName}$`] },
  });
  return containers.length > 0 ? containers[0] : null;
}

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
    Driver: "bridge",
    Labels: {
      "econome.tenant.id": tenant.id,
      "econome.tenant.slug": tenant.slug,
    },
  });

  return network.id;
}

export async function createPostgresContainer(
  tenant: Tenant,
  networkName: string,
  port: number
): Promise<ContainerInfo> {
  const containerName = getContainerName(tenant, "postgres");

  // Check if container already exists
  const existing = await getExistingContainer(containerName);
  if (existing) {
    console.log(`Container ${containerName} already exists, reusing...`);
    // Start if stopped
    if (existing.State !== "running") {
      const container = docker.getContainer(existing.Id);
      await container.start();
    }
    return {
      containerId: existing.Id,
      containerName,
      status: "running",
      port,
    };
  }

  // Pull image if not exists
  if (!(await imageExists(POSTGRES_IMAGE))) {
    await pullImage(POSTGRES_IMAGE);
  }

  const dbName = `medusa_${tenant.slug}`;
  const dbUser = `medusa_${tenant.slug}`;
  const dbPassword = generatePassword();
  const volumeName = `tenant_${tenant.slug}_postgres_data`;

  // Create volume if it doesn't exist
  try {
    await docker.createVolume({ Name: volumeName });
  } catch {
    // Volume might already exist
  }

  const container = await docker.createContainer({
    Image: POSTGRES_IMAGE,
    name: containerName,
    Env: [
      `POSTGRES_DB=${dbName}`,
      `POSTGRES_USER=${dbUser}`,
      `POSTGRES_PASSWORD=${dbPassword}`,
      `PGDATA=/var/lib/postgresql/data/pgdata`,
    ],
    Labels: {
      "econome.tenant.id": tenant.id,
      "econome.tenant.slug": tenant.slug,
      "econome.service": "postgres",
      "econome.db.name": dbName,
      "econome.db.user": dbUser,
      "econome.db.password": dbPassword,
    },
    HostConfig: {
      NetworkMode: networkName,
      PortBindings: {
        "5432/tcp": [{ HostPort: port.toString() }],
      },
      RestartPolicy: { Name: "unless-stopped" },
      Binds: [`${volumeName}:/var/lib/postgresql/data`],
    },
    Healthcheck: {
      Test: ["CMD-SHELL", `pg_isready -U ${dbUser} -d ${dbName}`],
      Interval: 5000000000, // 5s
      Timeout: 5000000000,
      Retries: 5,
    },
    ExposedPorts: { "5432/tcp": {} },
  });

  await container.start();

  return {
    containerId: container.id,
    containerName,
    status: "running",
    port,
  };
}

export async function createRedisContainer(
  tenant: Tenant,
  networkName: string,
  port: number
): Promise<ContainerInfo> {
  const containerName = getContainerName(tenant, "redis");

  // Check if container already exists
  const existing = await getExistingContainer(containerName);
  if (existing) {
    console.log(`Container ${containerName} already exists, reusing...`);
    // Start if stopped
    if (existing.State !== "running") {
      const container = docker.getContainer(existing.Id);
      await container.start();
    }
    return {
      containerId: existing.Id,
      containerName,
      status: "running",
      port,
    };
  }

  // Pull image if not exists
  if (!(await imageExists(REDIS_IMAGE))) {
    await pullImage(REDIS_IMAGE);
  }

  const volumeName = `tenant_${tenant.slug}_redis_data`;

  // Create volume if it doesn't exist
  try {
    await docker.createVolume({ Name: volumeName });
  } catch {
    // Volume might already exist
  }

  const container = await docker.createContainer({
    Image: REDIS_IMAGE,
    name: containerName,
    Cmd: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec"],
    Labels: {
      "econome.tenant.id": tenant.id,
      "econome.tenant.slug": tenant.slug,
      "econome.service": "redis",
    },
    HostConfig: {
      NetworkMode: networkName,
      PortBindings: {
        "6379/tcp": [{ HostPort: port.toString() }],
      },
      RestartPolicy: { Name: "unless-stopped" },
      Binds: [`${volumeName}:/data`],
    },
    Healthcheck: {
      Test: ["CMD", "redis-cli", "ping"],
      Interval: 5000000000,
      Timeout: 5000000000,
      Retries: 5,
    },
    ExposedPorts: { "6379/tcp": {} },
  });

  await container.start();

  return {
    containerId: container.id,
    containerName,
    status: "running",
    port,
  };
}

export async function createMedusaContainer(
  tenant: Tenant,
  networkName: string,
  postgresContainer: ContainerInfo,
  redisContainer: ContainerInfo,
  apiPort: number,
  adminPort: number,
  imageTag?: string
): Promise<ContainerInfo> {
  const image = imageTag || DEFAULT_MEDUSA_IMAGE;
  const containerName = getContainerName(tenant, "medusa");

  // Check if container already exists
  const existing = await getExistingContainer(containerName);
  if (existing) {
    // For Medusa containers, check if labels are correct - if not, recreate
    const container = docker.getContainer(existing.Id);
    const inspection = await container.inspect();
    const existingLabels = inspection.Config.Labels || {};

    const expectedHostRule = `Host(\`store.${tenant.subdomain}.${DOMAIN}\`)`;
    const hasCorrectLabels = existingLabels[`traefik.http.routers.${tenant.slug}-store.rule`] === expectedHostRule;

    if (!hasCorrectLabels) {
      console.log(`Container ${containerName} has outdated labels, recreating...`);
      try {
        await container.stop();
      } catch {
        // Container might already be stopped
      }
      await container.remove({ force: true });
    } else {
      console.log(`Container ${containerName} already exists with correct labels, reusing...`);
      // Ensure it's connected to platform_network
      try {
        const platformNetwork = docker.getNetwork("platform_network");
        const networkInfo = await platformNetwork.inspect();
        const isConnected = networkInfo.Containers && networkInfo.Containers[existing.Id];
        if (!isConnected) {
          console.log(`Connecting ${containerName} to platform_network...`);
          await platformNetwork.connect({ Container: existing.Id });
        }
      } catch (err) {
        console.warn("Error checking/connecting platform_network:", err);
      }

      // Start if stopped
      if (existing.State !== "running") {
        await container.start();
      }
      return {
        containerId: existing.Id,
        containerName,
        status: "running",
        port: apiPort,
      };
    }
  }

  const postgresName = getContainerName(tenant, "postgres");
  const redisName = getContainerName(tenant, "redis");

  // Get postgres credentials from container labels
  const postgresContainerInfo = docker.getContainer(
    postgresContainer.containerId
  );
  const postgresInspect = await postgresContainerInfo.inspect();
  const labels = postgresInspect.Config.Labels || {};

  const dbName = labels["econome.db.name"];
  const dbUser = labels["econome.db.user"];
  const dbPassword = labels["econome.db.password"];

  const databaseUrl = `postgres://${dbUser}:${dbPassword}@${postgresName}:5432/${dbName}?sslmode=disable`;
  const redisUrl = `redis://${redisName}:6379`;

  const config = tenant.config as TenantConfig;

  // Determine CORS URLs based on environment
  // Client is at {subdomain}.{domain}, Store API is at store.{subdomain}.{domain}
  const protocol = IS_PRODUCTION ? "https" : "http";
  const clientUrl = `${protocol}://${tenant.subdomain}.${DOMAIN}`;
  const storeUrl = `${protocol}://store.${tenant.subdomain}.${DOMAIN}`;
  const defaultStoreCors = config.storeCors || clientUrl;
  const defaultAdminCors = config.adminCors || storeUrl;
  const defaultAuthCors = `${clientUrl},${storeUrl}`;

  const container = await docker.createContainer({
    Image: image,
    name: containerName,
    Env: [
      `DATABASE_URL=${databaseUrl}`,
      `REDIS_URL=${redisUrl}`,
      `CACHE_REDIS_URL=${redisUrl}`,
      `JWT_SECRET=${generateSecret()}`,
      `COOKIE_SECRET=${generateSecret()}`,
      `STORE_CORS=${defaultStoreCors}`,
      `ADMIN_CORS=${defaultAdminCors}`,
      `AUTH_CORS=${defaultAuthCors}`,
      `MEDUSA_BACKEND_URL=${storeUrl}`,
      `MEDUSA_ADMIN_ONBOARDING_TYPE=default`,
      `ADMIN_EMAIL=${tenant.adminEmail || "admin@example.com"}`,
      `ADMIN_PASSWORD=${tenant.adminPassword || "admin123"}`,
      `NODE_ENV=${IS_PRODUCTION ? "production" : "development"}`,
    ],
    Labels: {
      "econome.tenant.id": tenant.id,
      "econome.tenant.slug": tenant.slug,
      "econome.service": "medusa",
      // Traefik labels for dynamic routing
      // Medusa serves Store API at store.{subdomain}.{domain}
      // Admin dashboard is at store.{subdomain}.{domain}/app
      "traefik.enable": "true",
      "traefik.docker.network": "platform_network",
      // Router for store subdomain - API and Admin served from port 9000
      [`traefik.http.routers.${tenant.slug}-store.rule`]:
        `Host(\`store.${tenant.subdomain}.${DOMAIN}\`)`,
      [`traefik.http.routers.${tenant.slug}-store.entrypoints`]: IS_PRODUCTION ? "websecure" : "web",
      ...(IS_PRODUCTION && {
        [`traefik.http.routers.${tenant.slug}-store.tls`]: "true",
        [`traefik.http.routers.${tenant.slug}-store.tls.certresolver`]: "letsencrypt",
        [`traefik.http.routers.${tenant.slug}-store.middlewares`]: "tenant-cors@file,security-headers@file",
      }),
      [`traefik.http.routers.${tenant.slug}-store.service`]: `${tenant.slug}-store`,
      [`traefik.http.services.${tenant.slug}-store.loadbalancer.server.port`]: "9000",
    },
    HostConfig: {
      NetworkMode: networkName,
      PortBindings: {
        "9000/tcp": [{ HostPort: apiPort.toString() }],
      },
      RestartPolicy: { Name: "unless-stopped" },
    },
    Healthcheck: {
      Test: ["CMD", "curl", "-f", "http://localhost:9000/health"],
      Interval: 10000000000, // 10s
      Timeout: 10000000000,
      Retries: 10,
      StartPeriod: 60000000000, // 60s - give Medusa time to start
    },
    ExposedPorts: {
      "9000/tcp": {},
    },
  });

  await container.start();

  // Connect to platform_network for Traefik routing
  try {
    const platformNetwork = docker.getNetwork("platform_network");
    await platformNetwork.connect({ Container: container.id });
  } catch (err) {
    console.warn("Could not connect to platform_network:", err);
  }

  return {
    containerId: container.id,
    containerName,
    status: "running",
    port: apiPort,
  };
}

export async function createClientContainer(
  tenant: Tenant,
  networkName: string,
  port: number,
  imageTag?: string
): Promise<ContainerInfo> {
  const image = imageTag || DEFAULT_CLIENT_IMAGE;
  const containerName = getContainerName(tenant, "client");

  // Check if container already exists
  const existing = await getExistingContainer(containerName);
  if (existing) {
    // For Client containers, check if labels are correct - if not, recreate
    const container = docker.getContainer(existing.Id);
    const inspection = await container.inspect();
    const existingLabels = inspection.Config.Labels || {};

    const expectedHostRule = `Host(\`${tenant.subdomain}.${DOMAIN}\`)`;
    const hasCorrectLabels = existingLabels[`traefik.http.routers.${tenant.slug}-client.rule`] === expectedHostRule;

    if (!hasCorrectLabels) {
      console.log(`Container ${containerName} has outdated labels, recreating...`);
      try {
        await container.stop();
      } catch {
        // Container might already be stopped
      }
      await container.remove({ force: true });
    } else {
      console.log(`Container ${containerName} already exists with correct labels, reusing...`);
      // Ensure it's connected to platform_network
      try {
        const platformNetwork = docker.getNetwork("platform_network");
        const networkInfo = await platformNetwork.inspect();
        const isConnected = networkInfo.Containers && networkInfo.Containers[existing.Id];
        if (!isConnected) {
          console.log(`Connecting ${containerName} to platform_network...`);
          await platformNetwork.connect({ Container: existing.Id });
        }
      } catch (err) {
        console.warn("Error checking/connecting platform_network:", err);
      }

      // Start if stopped
      if (existing.State !== "running") {
        await container.start();
      }
      return {
        containerId: existing.Id,
        containerName,
        status: "running",
        port,
      };
    }
  }

  // Pull image if not exists
  if (!(await imageExists(image))) {
    await pullImage(image);
  }

  // Determine URLs based on environment
  const protocol = IS_PRODUCTION ? "https" : "http";
  const storeApiUrl = `${protocol}://store.${tenant.subdomain}.${DOMAIN}`;

  const container = await docker.createContainer({
    Image: image,
    name: containerName,
    Env: [
      `NODE_ENV=${IS_PRODUCTION ? "production" : "development"}`,
      `NEXT_PUBLIC_STORE_API_URL=${storeApiUrl}`,
      `NEXT_PUBLIC_DOMAIN=${DOMAIN}`,
    ],
    Labels: {
      "econome.tenant.id": tenant.id,
      "econome.tenant.slug": tenant.slug,
      "econome.service": "client",
      // Traefik labels for dynamic routing
      // Client serves the storefront at {subdomain}.{domain}
      "traefik.enable": "true",
      "traefik.docker.network": "platform_network",
      [`traefik.http.routers.${tenant.slug}-client.rule`]:
        `Host(\`${tenant.subdomain}.${DOMAIN}\`)`,
      [`traefik.http.routers.${tenant.slug}-client.entrypoints`]: IS_PRODUCTION ? "websecure" : "web",
      ...(IS_PRODUCTION && {
        [`traefik.http.routers.${tenant.slug}-client.tls`]: "true",
        [`traefik.http.routers.${tenant.slug}-client.tls.certresolver`]: "letsencrypt",
        [`traefik.http.routers.${tenant.slug}-client.middlewares`]: "security-headers@file",
      }),
      [`traefik.http.routers.${tenant.slug}-client.service`]: `${tenant.slug}-client`,
      [`traefik.http.services.${tenant.slug}-client.loadbalancer.server.port`]: "3002",
    },
    HostConfig: {
      NetworkMode: networkName,
      PortBindings: {
        "3002/tcp": [{ HostPort: port.toString() }],
      },
      RestartPolicy: { Name: "unless-stopped" },
    },
    Healthcheck: {
      Test: ["CMD", "curl", "-f", "http://localhost:3002/"],
      Interval: 10000000000, // 10s
      Timeout: 10000000000,
      Retries: 5,
      StartPeriod: 30000000000, // 30s
    },
    ExposedPorts: {
      "3002/tcp": {},
    },
  });

  await container.start();

  // Connect to platform_network for Traefik routing
  try {
    const platformNetwork = docker.getNetwork("platform_network");
    await platformNetwork.connect({ Container: container.id });
  } catch (err) {
    console.warn("Could not connect to platform_network:", err);
  }

  return {
    containerId: container.id,
    containerName,
    status: "running",
    port,
  };
}

export async function waitForHealthy(
  containerId: string,
  timeoutMs: number = 120000
): Promise<boolean> {
  const container = docker.getContainer(containerId);
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const info = await container.inspect();
    const health = info.State.Health;

    if (health?.Status === "healthy") {
      return true;
    }

    if (info.State.Status === "exited" || info.State.Status === "dead") {
      throw new Error(`Container ${containerId} exited unexpectedly`);
    }

    await sleep(2000);
  }

  return false;
}

export async function startContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.start();
}

export async function stopContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.stop();
}

export async function restartContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  await container.restart();
}

export async function removeContainer(containerId: string): Promise<void> {
  const container = docker.getContainer(containerId);
  try {
    await container.stop();
  } catch {
    // Container might already be stopped
  }
  await container.remove({ force: true });
}

export async function removeNetwork(networkId: string): Promise<void> {
  const network = docker.getNetwork(networkId);
  await network.remove();
}

export async function getContainerLogs(
  containerId: string,
  tail: number = 100
): Promise<string> {
  const container = docker.getContainer(containerId);
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
    timestamps: true,
  });

  return logs.toString("utf-8");
}

export async function getContainerStats(
  containerId: string
): Promise<{ cpu: number; memory: number; memoryLimit: number }> {
  const container = docker.getContainer(containerId);
  const stats = await container.stats({ stream: false });

  // Calculate CPU percentage
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuPercent =
    systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

  return {
    cpu: Math.round(cpuPercent * 100) / 100,
    memory: stats.memory_stats.usage || 0,
    memoryLimit: stats.memory_stats.limit || 0,
  };
}

export async function getContainerStatus(
  containerId: string
): Promise<string> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Status;
  } catch {
    return "not_found";
  }
}

export async function listTenantContainers(
  tenantId: string
): Promise<Docker.ContainerInfo[]> {
  return docker.listContainers({
    all: true,
    filters: {
      label: [`econome.tenant.id=${tenantId}`],
    },
  });
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
 * Pull an image from a container registry.
 * For public registries like ghcr.io with public images, no auth is needed.
 */
export async function pullImage(imageTag: string): Promise<void> {
  console.log(`Pulling image: ${imageTag}`);

  return new Promise((resolve, reject) => {
    docker.pull(imageTag, (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) {
        console.error(`Failed to pull image ${imageTag}:`, err);
        reject(err);
        return;
      }

      // Follow the pull progress
      docker.modem.followProgress(
        stream,
        (err: Error | null, output: unknown[]) => {
          if (err) {
            console.error(`Error during image pull ${imageTag}:`, err);
            reject(err);
            return;
          }
          console.log(`Successfully pulled image: ${imageTag}`);
          resolve();
        },
        (event: { status?: string; progress?: string }) => {
          // Log progress events
          if (event.status) {
            const progress = event.progress ? ` ${event.progress}` : "";
            console.log(`  ${event.status}${progress}`);
          }
        }
      );
    });
  });
}

/**
 * Check if an image exists locally.
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

// Port allocation
let nextPostgresPort = 5500;
let nextRedisPort = 6400;
let nextMedusaApiPort = 9100;
let nextMedusaAdminPort = 5200;
let nextClientPort = 3100;

export function allocatePorts(): {
  postgres: number;
  redis: number;
  medusaApi: number;
  medusaAdmin: number;
  client: number;
} {
  const ports = {
    postgres: nextPostgresPort++,
    redis: nextRedisPort++,
    medusaApi: nextMedusaApiPort++,
    medusaAdmin: nextMedusaAdminPort++,
    client: nextClientPort++,
  };
  return ports;
}

export { docker };
