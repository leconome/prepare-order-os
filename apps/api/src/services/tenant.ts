import { eq, desc, isNull, and } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  tenants,
  tenantResources,
  tenantEvents,
  type Tenant,
  type TenantConfig,
} from "../db/schema.js";
import * as dockerService from "./docker.js";

export interface CreateTenantInput {
  name: string;
  slug: string;
  subdomain: string;
  adminEmail?: string;
  adminPassword?: string;
  config?: TenantConfig;
}

export interface TenantWithResources extends Tenant {
  resources: Array<{
    resourceType: string;
    containerId: string | null;
    containerName: string | null;
    networkId: string | null;
    status: string;
    port: number | null;
  }>;
}

// Get all tenants (excluding soft-deleted)
export async function listTenants(): Promise<Tenant[]> {
  return db
    .select()
    .from(tenants)
    .where(isNull(tenants.deletedAt))
    .orderBy(desc(tenants.createdAt));
}

// Get tenant by ID with resources
export async function getTenant(id: string): Promise<TenantWithResources | null> {
  const tenant = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
    .limit(1);

  if (tenant.length === 0) return null;

  const resources = await db
    .select({
      resourceType: tenantResources.resourceType,
      containerId: tenantResources.containerId,
      containerName: tenantResources.containerName,
      networkId: tenantResources.networkId,
      status: tenantResources.status,
      port: tenantResources.port,
    })
    .from(tenantResources)
    .where(eq(tenantResources.tenantId, id));

  return { ...tenant[0], resources };
}

// Get tenant by slug
export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  const result = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, slug), isNull(tenants.deletedAt)))
    .limit(1);

  return result[0] || null;
}

// Create a new tenant (just the record, not provisioned)
export async function createTenant(input: CreateTenantInput): Promise<Tenant> {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: input.name,
      slug: input.slug,
      subdomain: input.subdomain,
      adminEmail: input.adminEmail,
      adminPassword: input.adminPassword,
      config: input.config || {},
      status: "pending",
    })
    .returning();

  await logEvent(tenant.id, "created", `Tenant ${tenant.name} created`);

  return tenant;
}

// Provision tenant containers
export async function provisionTenant(tenantId: string): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "pending" && tenant.status !== "failed") {
    throw new Error(`Cannot provision tenant in status: ${tenant.status}`);
  }

  // Update status to provisioning
  await db
    .update(tenants)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  await logEvent(tenantId, "provisioning_started", "Starting container provisioning");

  try {
    const ports = dockerService.allocatePorts();

    // Create network
    const networkId = await dockerService.createTenantNetwork(tenant);
    const networkName = `tenant_${tenant.slug}_network`;

    await db.insert(tenantResources).values({
      tenantId,
      resourceType: "network",
      networkId,
      containerName: networkName,
      status: "running",
    });

    // Create PostgreSQL
    const postgres = await dockerService.createPostgresContainer(
      tenant,
      networkName,
      ports.postgres
    );

    await db.insert(tenantResources).values({
      tenantId,
      resourceType: "postgres",
      containerId: postgres.containerId,
      containerName: postgres.containerName,
      status: "running",
      port: postgres.port,
    });

    // Wait for PostgreSQL to be healthy
    await dockerService.waitForHealthy(postgres.containerId, 60000);

    // Create Redis
    const redis = await dockerService.createRedisContainer(
      tenant,
      networkName,
      ports.redis
    );

    await db.insert(tenantResources).values({
      tenantId,
      resourceType: "redis",
      containerId: redis.containerId,
      containerName: redis.containerName,
      status: "running",
      port: redis.port,
    });

    // Wait for Redis to be healthy
    await dockerService.waitForHealthy(redis.containerId, 30000);

    // Create Medusa
    const medusa = await dockerService.createMedusaContainer(
      tenant,
      networkName,
      postgres,
      redis,
      ports.medusaApi,
      ports.medusaAdmin
    );

    await db.insert(tenantResources).values({
      tenantId,
      resourceType: "medusa",
      containerId: medusa.containerId,
      containerName: medusa.containerName,
      status: "running",
      port: medusa.port,
      metadata: { adminPort: ports.medusaAdmin },
    });

    // Update tenant status and config with allocated ports
    const [updatedTenant] = await db
      .update(tenants)
      .set({
        status: "running",
        config: {
          ...(tenant.config as TenantConfig),
          postgresPort: ports.postgres,
          redisPort: ports.redis,
          medusaPort: ports.medusaApi,
          adminPort: ports.medusaAdmin,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    await logEvent(tenantId, "provisioning_completed", "All containers are running");

    return updatedTenant;
  } catch (error) {
    // Update status to failed
    await db
      .update(tenants)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    await logEvent(
      tenantId,
      "failed",
      `Provisioning failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { error: String(error) }
    );

    throw error;
  }
}

// Stop tenant containers
export async function stopTenant(tenantId: string): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "running") {
    throw new Error(`Cannot stop tenant in status: ${tenant.status}`);
  }

  for (const resource of tenant.resources) {
    if (resource.containerId) {
      await dockerService.stopContainer(resource.containerId);
      await db
        .update(tenantResources)
        .set({ status: "stopped" })
        .where(eq(tenantResources.containerId, resource.containerId));
    }
  }

  const [updatedTenant] = await db
    .update(tenants)
    .set({ status: "stopped", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();

  await logEvent(tenantId, "stopped", "Tenant containers stopped");

  return updatedTenant;
}

// Start tenant containers
export async function startTenant(tenantId: string): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "stopped") {
    throw new Error(`Cannot start tenant in status: ${tenant.status}`);
  }

  // Start containers in order: postgres, redis, medusa
  const order = ["postgres", "redis", "medusa"];
  for (const resourceType of order) {
    const resource = tenant.resources.find((r) => r.resourceType === resourceType);
    if (resource?.containerId) {
      await dockerService.startContainer(resource.containerId);
      await db
        .update(tenantResources)
        .set({ status: "running" })
        .where(eq(tenantResources.containerId, resource.containerId));
    }
  }

  const [updatedTenant] = await db
    .update(tenants)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();

  await logEvent(tenantId, "started", "Tenant containers started");

  return updatedTenant;
}

// Restart tenant containers
export async function restartTenant(tenantId: string): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "running" && tenant.status !== "stopped") {
    throw new Error(`Cannot restart tenant in status: ${tenant.status}`);
  }

  for (const resource of tenant.resources) {
    if (resource.containerId) {
      await dockerService.restartContainer(resource.containerId);
    }
  }

  const [updatedTenant] = await db
    .update(tenants)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();

  await logEvent(tenantId, "restarted", "Tenant containers restarted");

  return updatedTenant;
}

// Delete tenant (terminate and cleanup)
export async function deleteTenant(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  await db
    .update(tenants)
    .set({ status: "terminating", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  await logEvent(tenantId, "terminating", "Starting tenant termination");

  // Remove containers in reverse order
  const order = ["medusa", "redis", "postgres"];
  for (const resourceType of order) {
    const resource = tenant.resources.find((r) => r.resourceType === resourceType);
    if (resource?.containerId) {
      await dockerService.removeContainer(resource.containerId);
    }
  }

  // Remove network
  const networkResource = tenant.resources.find((r) => r.resourceType === "network");
  if (networkResource?.networkId) {
    await dockerService.removeNetwork(networkResource.networkId);
  }

  // Soft delete tenant
  await db
    .update(tenants)
    .set({
      status: "terminated",
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  await logEvent(tenantId, "terminated", "Tenant terminated and cleaned up");
}

// Get tenant logs
export async function getTenantLogs(
  tenantId: string,
  service: "medusa" | "postgres" | "redis" = "medusa",
  tail: number = 100
): Promise<string> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const resource = tenant.resources.find((r) => r.resourceType === service);
  if (!resource?.containerId) {
    throw new Error(`No ${service} container found`);
  }

  return dockerService.getContainerLogs(resource.containerId, tail);
}

// Get tenant health/stats
export async function getTenantHealth(tenantId: string): Promise<{
  status: string;
  containers: Record<string, { status: string; stats?: { cpu: number; memory: number } }>;
}> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const containers: Record<string, { status: string; stats?: { cpu: number; memory: number } }> = {};

  for (const resource of tenant.resources) {
    if (resource.containerId) {
      const status = await dockerService.getContainerStatus(resource.containerId);
      let stats: { cpu: number; memory: number } | undefined;

      if (status === "running") {
        try {
          const containerStats = await dockerService.getContainerStats(resource.containerId);
          stats = {
            cpu: containerStats.cpu,
            memory: Math.round(containerStats.memory / 1024 / 1024), // MB
          };
        } catch {
          // Stats might not be available
        }
      }

      containers[resource.resourceType] = { status, stats };
    }
  }

  return { status: tenant.status, containers };
}

// Get tenant events
export async function getTenantEvents(
  tenantId: string,
  limit: number = 50
): Promise<Array<{ eventType: string; message: string | null; createdAt: Date }>> {
  return db
    .select({
      eventType: tenantEvents.eventType,
      message: tenantEvents.message,
      createdAt: tenantEvents.createdAt,
    })
    .from(tenantEvents)
    .where(eq(tenantEvents.tenantId, tenantId))
    .orderBy(desc(tenantEvents.createdAt))
    .limit(limit);
}

// Update tenant config
export async function updateTenant(
  tenantId: string,
  updates: Partial<Pick<Tenant, "name" | "adminEmail" | "config">>
): Promise<Tenant> {
  const [updatedTenant] = await db
    .update(tenants)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId))
    .returning();

  return updatedTenant;
}

// Helper: Log tenant event
async function logEvent(
  tenantId: string,
  eventType: (typeof tenantEvents.$inferInsert)["eventType"],
  message: string,
  details?: Record<string, unknown>
): Promise<void> {
  await db.insert(tenantEvents).values({
    tenantId,
    eventType,
    message,
    details: details || {},
  });
}
