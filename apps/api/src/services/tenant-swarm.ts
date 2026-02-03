/**
 * Tenant Service - Swarm Mode
 * Manages tenant lifecycle using Docker Swarm services
 */

import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
	type Tenant,
	tenantEvents,
	tenantResources,
	tenants,
} from "../db/schema.js";
import * as swarmService from "./docker-swarm.js";

export async function getTenant(id: string): Promise<Tenant | null> {
	const results = await db
		.select()
		.from(tenants)
		.where(eq(tenants.id, id))
		.limit(1);

	if (results.length === 0) return null;

	// Get resources
	const resources = await db
		.select()
		.from(tenantResources)
		.where(eq(tenantResources.tenantId, id));

	return { ...results[0], resources } as Tenant & {
		resources: typeof resources;
	};
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
	const results = await db
		.select()
		.from(tenants)
		.where(eq(tenants.slug, slug))
		.limit(1);

	return results[0] || null;
}

export async function listTenants(): Promise<Tenant[]> {
	return db.select().from(tenants);
}

export async function createTenant(input: {
	name: string;
	slug: string;
	subdomain: string;
	adminEmail?: string;
	adminPassword?: string;
	config?: Record<string, unknown>;
	version?: string;
}): Promise<Tenant> {
	const [tenant] = await db
		.insert(tenants)
		.values({
			name: input.name,
			slug: input.slug,
			subdomain: input.subdomain,
			status: "pending",
			config: input.config || {},
			adminEmail: input.adminEmail,
			adminPassword: input.adminPassword,
			medusaVersion: input.version,
		})
		.returning();

	await logEvent(tenant.id, "tenant_created", `Tenant ${tenant.name} created`);

	return tenant;
}

export async function provisionTenant(
	id: string,
	version?: string,
): Promise<Tenant> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	await updateTenantStatus(id, "provisioning");
	await logEvent(
		id,
		"provisioning_started",
		"Starting tenant provisioning (Swarm mode)",
	);

	try {
		// Create overlay network
		const networkId = await swarmService.createTenantNetwork(tenant);
		await saveResource(
			id,
			"network",
			networkId,
			`tenant_${tenant.slug}_network`,
		);
		await logEvent(id, "network_created", "Overlay network created");

		// Create PostgreSQL service
		const postgres = await swarmService.createPostgresService(
			tenant,
			`tenant_${tenant.slug}_network`,
		);
		await saveResource(
			id,
			"postgres",
			postgres.serviceId,
			postgres.serviceName,
		);
		await logEvent(id, "postgres_created", "PostgreSQL service created");

		// Wait for PostgreSQL to be healthy
		await swarmService.waitForServiceHealthy(postgres.serviceName, 60000);
		await logEvent(id, "postgres_healthy", "PostgreSQL service is healthy");

		// Create Redis service
		const redis = await swarmService.createRedisService(
			tenant,
			`tenant_${tenant.slug}_network`,
		);
		await saveResource(id, "redis", redis.serviceId, redis.serviceName);
		await logEvent(id, "redis_created", "Redis service created");

		// Wait for Redis to be healthy
		await swarmService.waitForServiceHealthy(redis.serviceName, 30000);
		await logEvent(id, "redis_healthy", "Redis service is healthy");

		// Pull Medusa image if needed
		const imageTag = version
			? `ghcr.io/leconome/medusa:${version}`
			: process.env.DEFAULT_MEDUSA_IMAGE || "ghcr.io/leconome/medusa:latest";

		if (!(await swarmService.imageExists(imageTag))) {
			await logEvent(id, "image_pulling", `Pulling image ${imageTag}`);
			await swarmService.pullImage(imageTag);
		}

		// Create Medusa service
		const medusa = await swarmService.createMedusaService(
			tenant,
			`tenant_${tenant.slug}_network`,
			postgres,
			redis,
			imageTag,
		);
		await saveResource(id, "medusa", medusa.serviceId, medusa.serviceName);
		await logEvent(id, "medusa_created", "Medusa service created");

		// Update tenant with version info
		await db
			.update(tenants)
			.set({
				medusaVersion: version || "latest",
				imageTag,
				status: "running",
				updatedAt: new Date(),
			})
			.where(eq(tenants.id, id));

		await logEvent(
			id,
			"provisioning_completed",
			"Tenant provisioning completed",
		);

		return (await getTenant(id))!;
	} catch (error) {
		await updateTenantStatus(id, "failed");
		await logEvent(
			id,
			"provisioning_failed",
			`Provisioning failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

export async function upgradeTenant(
	id: string,
	version: string,
): Promise<Tenant> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	const imageTag = `ghcr.io/leconome/medusa:${version}`;
	const serviceName = `tenant_${tenant.slug}_medusa`;

	await logEvent(id, "upgrade_started", `Upgrading to version ${version}`);

	try {
		// Pull the new image first
		if (!(await swarmService.imageExists(imageTag))) {
			await logEvent(id, "image_pulling", `Pulling image ${imageTag}`);
			await swarmService.pullImage(imageTag);
		}

		// Update the service (zero-downtime with start-first)
		await swarmService.updateServiceImage(serviceName, imageTag);
		await logEvent(
			id,
			"service_updating",
			"Service update initiated (zero-downtime)",
		);

		// Wait for the new version to be healthy
		await swarmService.waitForServiceHealthy(serviceName, 180000);

		// Update tenant record
		await db
			.update(tenants)
			.set({
				medusaVersion: version,
				imageTag,
				lastUpgradedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(tenants.id, id));

		await logEvent(
			id,
			"upgrade_completed",
			`Successfully upgraded to version ${version}`,
		);

		return (await getTenant(id))!;
	} catch (error) {
		await logEvent(
			id,
			"upgrade_failed",
			`Upgrade failed: ${error instanceof Error ? error.message : String(error)}`,
		);
		throw error;
	}
}

export async function startTenant(id: string): Promise<Tenant> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	const services = ["postgres", "redis", "medusa"];

	for (const svc of services) {
		const serviceName = `tenant_${tenant.slug}_${svc}`;
		try {
			await swarmService.scaleService(serviceName, 1);
		} catch (error) {
			console.error(`Failed to start ${serviceName}:`, error);
		}
	}

	await updateTenantStatus(id, "running");
	await logEvent(id, "tenant_started", "Tenant services started");

	return (await getTenant(id))!;
}

export async function stopTenant(id: string): Promise<Tenant> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	// Stop in reverse order
	const services = ["medusa", "redis", "postgres"];

	for (const svc of services) {
		const serviceName = `tenant_${tenant.slug}_${svc}`;
		try {
			await swarmService.scaleService(serviceName, 0);
		} catch (error) {
			console.error(`Failed to stop ${serviceName}:`, error);
		}
	}

	await updateTenantStatus(id, "stopped");
	await logEvent(id, "tenant_stopped", "Tenant services stopped");

	return (await getTenant(id))!;
}

export async function restartTenant(id: string): Promise<Tenant> {
	await stopTenant(id);
	await new Promise((r) => setTimeout(r, 2000));
	return startTenant(id);
}

export async function deleteTenant(id: string): Promise<void> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	await updateTenantStatus(id, "terminating");
	await logEvent(id, "deletion_started", "Starting tenant deletion");

	// Remove services in reverse order
	const services = ["medusa", "redis", "postgres"];
	for (const svc of services) {
		const serviceName = `tenant_${tenant.slug}_${svc}`;
		try {
			await swarmService.removeService(serviceName);
		} catch (error) {
			console.error(`Failed to remove ${serviceName}:`, error);
		}
	}

	// Remove network
	try {
		await swarmService.removeNetwork(`tenant_${tenant.slug}_network`);
	} catch (error) {
		console.error("Failed to remove network:", error);
	}

	// Delete from database
	await db.delete(tenantResources).where(eq(tenantResources.tenantId, id));
	await db.delete(tenantEvents).where(eq(tenantEvents.tenantId, id));
	await db.delete(tenants).where(eq(tenants.id, id));
}

export async function getTenantLogs(
	id: string,
	service: "medusa" | "postgres" | "redis" = "medusa",
	tail: number = 100,
): Promise<string> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	const serviceName = `tenant_${tenant.slug}_${service}`;
	return swarmService.getServiceLogs(serviceName, tail);
}

export async function getTenantHealth(id: string): Promise<{
	status: string;
	services: Record<
		string,
		{ status: string; replicas: { running: number; desired: number } }
	>;
}> {
	const tenant = await getTenant(id);
	if (!tenant) throw new Error("Tenant not found");

	const services: Record<
		string,
		{ status: string; replicas: { running: number; desired: number } }
	> = {};

	for (const svc of ["postgres", "redis", "medusa"]) {
		const serviceName = `tenant_${tenant.slug}_${svc}`;
		const status = await swarmService.getServiceStatus(serviceName);
		services[svc] = {
			status: status.status,
			replicas: { running: status.running, desired: status.desired },
		};
	}

	// Overall status
	const allRunning = Object.values(services).every(
		(s) => s.status === "running" && s.replicas.running >= s.replicas.desired,
	);
	const anyFailed = Object.values(services).some(
		(s) => s.status === "not_found",
	);

	return {
		status: allRunning ? "healthy" : anyFailed ? "unhealthy" : "degraded",
		services,
	};
}

export async function getTenantEvents(id: string, limit: number = 50) {
	return db
		.select()
		.from(tenantEvents)
		.where(eq(tenantEvents.tenantId, id))
		.orderBy(tenantEvents.createdAt)
		.limit(limit);
}

export async function updateTenant(
	id: string,
	updates: Partial<Pick<Tenant, "name" | "adminEmail" | "config">>,
): Promise<Tenant> {
	await db
		.update(tenants)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(tenants.id, id));

	return (await getTenant(id))!;
}

// Helper functions
async function updateTenantStatus(
	id: string,
	status: Tenant["status"],
): Promise<void> {
	await db
		.update(tenants)
		.set({ status, updatedAt: new Date() })
		.where(eq(tenants.id, id));
}

type EventType =
	| "created"
	| "tenant_created"
	| "provisioning_started"
	| "provisioning_completed"
	| "provisioning_failed"
	| "network_created"
	| "postgres_created"
	| "postgres_healthy"
	| "redis_created"
	| "redis_healthy"
	| "medusa_created"
	| "image_pulling"
	| "service_updating"
	| "started"
	| "tenant_started"
	| "stopped"
	| "tenant_stopped"
	| "restarted"
	| "failed"
	| "terminating"
	| "deletion_started"
	| "terminated"
	| "upgrade_started"
	| "upgrade_completed"
	| "upgrade_failed";
type ResourceType = "network" | "postgres" | "redis" | "medusa";

async function logEvent(
	tenantId: string,
	eventType: EventType,
	message: string,
): Promise<void> {
	await db.insert(tenantEvents).values({
		tenantId,
		eventType,
		message,
	});
}

async function saveResource(
	tenantId: string,
	resourceType: ResourceType,
	serviceId: string,
	serviceName: string,
): Promise<void> {
	// Check if resource exists
	const existing = await db
		.select()
		.from(tenantResources)
		.where(eq(tenantResources.tenantId, tenantId))
		.then((r) => r.find((x) => x.resourceType === resourceType));

	if (existing) {
		await db
			.update(tenantResources)
			.set({
				containerId: serviceId,
				containerName: serviceName,
				status: "running",
			})
			.where(eq(tenantResources.id, existing.id));
	} else {
		await db.insert(tenantResources).values({
			tenantId,
			resourceType,
			containerId: serviceId,
			containerName: serviceName,
			status: "running",
		});
	}
}
