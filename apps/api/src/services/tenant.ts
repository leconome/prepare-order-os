import { eq, desc, isNull, and } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  tenants,
  tenantResources,
  tenantEvents,
  platformImages,
  type Tenant,
  type TenantConfig,
} from "../db/schema.js";
import * as dockerService from "./docker.js";

// Resource type literal type
type ResourceType = "network" | "postgres" | "redis" | "medusa";
type ResourceStatus = "creating" | "running" | "stopped" | "error";

// Helper to upsert a tenant resource (insert or update if exists)
async function upsertResource(
  tenantId: string,
  resourceType: ResourceType,
  data: {
    containerId?: string | null;
    containerName?: string | null;
    networkId?: string | null;
    status: ResourceStatus;
    port?: number | null;
    metadata?: Record<string, unknown>;
  }
) {
  // Check if resource already exists
  const existing = await db
    .select()
    .from(tenantResources)
    .where(
      and(
        eq(tenantResources.tenantId, tenantId),
        eq(tenantResources.resourceType, resourceType)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await db
      .update(tenantResources)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tenantResources.id, existing[0].id));
  } else {
    // Insert new
    await db.insert(tenantResources).values({
      tenantId,
      resourceType,
      ...data,
    });
  }
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  subdomain: string;
  adminEmail?: string;
  adminPassword?: string;
  config?: TenantConfig;
  version?: string;
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
export async function provisionTenant(
  tenantId: string,
  version?: string
): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "pending" && tenant.status !== "failed") {
    throw new Error(`Cannot provision tenant in status: ${tenant.status}`);
  }

  // Resolve image tag from version
  let imageTag: string | undefined;
  let medusaVersion: string | undefined;

  if (version) {
    const [image] = await db
      .select()
      .from(platformImages)
      .where(eq(platformImages.version, version))
      .limit(1);

    if (!image) {
      throw new Error(`Version ${version} not found`);
    }

    if (image.isDeprecated) {
      throw new Error(`Version ${version} is deprecated`);
    }

    imageTag = image.imageTag;
    medusaVersion = image.version;
  } else {
    // Try to get the latest version
    const [latestImage] = await db
      .select()
      .from(platformImages)
      .where(eq(platformImages.isLatest, true))
      .limit(1);

    if (latestImage) {
      imageTag = latestImage.imageTag;
      medusaVersion = latestImage.version;
    }
    // If no version in DB, will use default image from docker service
  }

  // Update status to provisioning
  await db
    .update(tenants)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  await logEvent(
    tenantId,
    "provisioning_started",
    `Starting container provisioning${medusaVersion ? ` with version ${medusaVersion}` : ""}`
  );

  try {
    // Pull the image if specified
    if (imageTag) {
      const exists = await dockerService.imageExists(imageTag);
      if (!exists) {
        await dockerService.pullImage(imageTag);
      }
    }

    const ports = dockerService.allocatePorts();

    // Create network
    const networkId = await dockerService.createTenantNetwork(tenant);
    const networkName = `tenant_${tenant.slug}_network`;

    await upsertResource(tenantId, "network", {
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

    await upsertResource(tenantId, "postgres", {
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

    await upsertResource(tenantId, "redis", {
      containerId: redis.containerId,
      containerName: redis.containerName,
      status: "running",
      port: redis.port,
    });

    // Wait for Redis to be healthy
    await dockerService.waitForHealthy(redis.containerId, 30000);

    // Create Medusa with specific image tag
    const medusa = await dockerService.createMedusaContainer(
      tenant,
      networkName,
      postgres,
      redis,
      ports.medusaApi,
      ports.medusaAdmin,
      imageTag
    );

    await upsertResource(tenantId, "medusa", {
      containerId: medusa.containerId,
      containerName: medusa.containerName,
      status: "running",
      port: medusa.port,
      metadata: { adminPort: ports.medusaAdmin, imageTag },
    });

    // Update tenant status, config with allocated ports, and version info
    const [updatedTenant] = await db
      .update(tenants)
      .set({
        status: "running",
        medusaVersion: medusaVersion || null,
        imageTag: imageTag || null,
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

// Upgrade tenant to a new Medusa version
export async function upgradeTenant(
  tenantId: string,
  targetVersion: string
): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "running" && tenant.status !== "stopped") {
    throw new Error(`Cannot upgrade tenant in status: ${tenant.status}`);
  }

  // Get target version image
  const [targetImage] = await db
    .select()
    .from(platformImages)
    .where(eq(platformImages.version, targetVersion))
    .limit(1);

  if (!targetImage) {
    throw new Error(`Version ${targetVersion} not found`);
  }

  if (targetImage.isDeprecated) {
    throw new Error(`Version ${targetVersion} is deprecated`);
  }

  if (tenant.medusaVersion === targetVersion) {
    throw new Error(`Tenant is already running version ${targetVersion}`);
  }

  const previousVersion = tenant.medusaVersion;

  await logEvent(
    tenantId,
    "upgrade_started",
    `Upgrading from ${previousVersion || "unknown"} to ${targetVersion}`,
    { previousVersion, targetVersion }
  );

  try {
    // Pull the new image
    const exists = await dockerService.imageExists(targetImage.imageTag);
    if (!exists) {
      await dockerService.pullImage(targetImage.imageTag);
    }

    // Find the medusa resource
    const medusaResource = tenant.resources.find((r) => r.resourceType === "medusa");
    if (!medusaResource?.containerId) {
      throw new Error("Medusa container not found");
    }

    // Find postgres and redis resources for recreating medusa
    const postgresResource = tenant.resources.find((r) => r.resourceType === "postgres");
    const redisResource = tenant.resources.find((r) => r.resourceType === "redis");

    if (!postgresResource?.containerId || !redisResource?.containerId) {
      throw new Error("Required containers not found");
    }

    const networkName = `tenant_${tenant.slug}_network`;
    const config = tenant.config as TenantConfig;

    // Stop and remove the old medusa container
    await dockerService.removeContainer(medusaResource.containerId);

    // Create new medusa container with the new image
    const medusa = await dockerService.createMedusaContainer(
      tenant,
      networkName,
      {
        containerId: postgresResource.containerId,
        containerName: postgresResource.containerName || "",
        status: "running",
        port: postgresResource.port || undefined,
      },
      {
        containerId: redisResource.containerId,
        containerName: redisResource.containerName || "",
        status: "running",
        port: redisResource.port || undefined,
      },
      config.medusaPort || 9000,
      config.adminPort || 5173,
      targetImage.imageTag
    );

    // Update medusa resource record
    await db
      .update(tenantResources)
      .set({
        containerId: medusa.containerId,
        containerName: medusa.containerName,
        status: "running",
        metadata: { adminPort: config.adminPort, imageTag: targetImage.imageTag },
      })
      .where(
        and(
          eq(tenantResources.tenantId, tenantId),
          eq(tenantResources.resourceType, "medusa")
        )
      );

    // Update tenant record with new version info
    const [updatedTenant] = await db
      .update(tenants)
      .set({
        medusaVersion: targetVersion,
        imageTag: targetImage.imageTag,
        lastUpgradedAt: new Date(),
        status: "running",
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning();

    await logEvent(
      tenantId,
      "upgrade_completed",
      `Successfully upgraded to version ${targetVersion}`,
      { previousVersion, targetVersion }
    );

    return updatedTenant;
  } catch (error) {
    await logEvent(
      tenantId,
      "failed",
      `Upgrade failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { previousVersion, targetVersion, error: String(error) }
    );

    throw error;
  }
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
