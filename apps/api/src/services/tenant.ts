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

// Check if running in Swarm mode
const SWARM_MODE = process.env.SWARM_MODE === "true";

// Log mode on startup
console.log(`Tenant service running in ${SWARM_MODE ? "SWARM" : "CONTAINER"} mode`);

// Resource type literal type
type ResourceType = "network" | "postgres" | "redis" | "medusa" | "client";
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

    // Wait for Medusa to be healthy before starting client
    await dockerService.waitForHealthy(medusa.containerId, 120000);
    await logEvent(tenantId, "medusa_created", "Medusa container is healthy");

    // Create Client container
    const client = await dockerService.createClientContainer(
      tenant,
      networkName,
      ports.client
    );

    await upsertResource(tenantId, "client", {
      containerId: client.containerId,
      containerName: client.containerName,
      status: "running",
      port: client.port,
    });

    await logEvent(tenantId, "client_created", "Client storefront container created");

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
          clientPort: ports.client,
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
      try {
        const exists = await containerExists(resource.containerId);
        if (exists) {
          await dockerService.stopContainer(resource.containerId);
        } else {
          console.log(`Container ${resource.containerId} not found, skipping stop`);
        }
        await db
          .update(tenantResources)
          .set({ status: exists ? "stopped" : "error", updatedAt: new Date() })
          .where(eq(tenantResources.containerId, resource.containerId));
      } catch (error) {
        console.error(`Failed to stop ${resource.resourceType}:`, error);
        // Continue with other containers
      }
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

  if (tenant.status !== "stopped" && tenant.status !== "failed") {
    throw new Error(`Cannot start tenant in status: ${tenant.status}`);
  }

  // Check if any containers are missing
  let hasMissingContainers = false;
  const order = ["postgres", "redis", "medusa", "client"];

  for (const resourceType of order) {
    const resource = tenant.resources.find((r) => r.resourceType === resourceType);
    if (resource?.containerId) {
      const exists = await containerExists(resource.containerId);
      if (!exists) {
        console.log(`Container ${resource.containerId} for ${resourceType} not found`);
        hasMissingContainers = true;
        // Clear the container ID in DB since it no longer exists
        await db
          .update(tenantResources)
          .set({ containerId: null, status: "error", updatedAt: new Date() })
          .where(eq(tenantResources.containerId, resource.containerId));
      }
    } else if (resourceType !== "network") {
      // No container ID recorded - missing
      hasMissingContainers = true;
    }
  }

  // If containers are missing, trigger reprovisioning instead
  if (hasMissingContainers) {
    await logEvent(tenantId, "failed", "Some containers not found, triggering reprovisioning");

    // Reset tenant status to allow reprovisioning
    await db
      .update(tenants)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    // Trigger reprovisioning
    return provisionTenant(tenantId, tenant.medusaVersion || undefined);
  }

  // All containers exist, start them in order
  for (const resourceType of order) {
    const resource = tenant.resources.find((r) => r.resourceType === resourceType);
    if (resource?.containerId) {
      try {
        await dockerService.startContainer(resource.containerId);
        await db
          .update(tenantResources)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(tenantResources.containerId, resource.containerId));
      } catch (error) {
        console.error(`Failed to start ${resourceType}:`, error);
        throw new Error(`Failed to start ${resourceType}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
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

// Helper: Check if container exists and is accessible
async function containerExists(containerId: string): Promise<boolean> {
  const status = await dockerService.getContainerStatus(containerId);
  return status !== "not_found";
}

// Restart tenant containers
export async function restartTenant(tenantId: string): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "running" && tenant.status !== "stopped" && tenant.status !== "failed") {
    throw new Error(`Cannot restart tenant in status: ${tenant.status}`);
  }

  // Check if any containers are missing
  let hasMissingContainers = false;
  for (const resource of tenant.resources) {
    if (resource.containerId) {
      const exists = await containerExists(resource.containerId);
      if (!exists) {
        console.log(`Container ${resource.containerId} for ${resource.resourceType} not found`);
        hasMissingContainers = true;
        // Clear the container ID in DB since it no longer exists
        await db
          .update(tenantResources)
          .set({ containerId: null, status: "error", updatedAt: new Date() })
          .where(eq(tenantResources.containerId, resource.containerId));
      }
    }
  }

  // If containers are missing, trigger reprovisioning instead
  if (hasMissingContainers) {
    await logEvent(tenantId, "failed", "Some containers not found, triggering reprovisioning");

    // Reset tenant status to allow reprovisioning
    await db
      .update(tenants)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    // Trigger reprovisioning
    return provisionTenant(tenantId, tenant.medusaVersion || undefined);
  }

  // All containers exist, restart them
  for (const resource of tenant.resources) {
    if (resource.containerId) {
      try {
        await dockerService.restartContainer(resource.containerId);
      } catch (error) {
        console.error(`Failed to restart ${resource.resourceType}:`, error);
        // Container might have disappeared between check and restart
        // Mark as error and continue
        await db
          .update(tenantResources)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(tenantResources.containerId, resource.containerId));
      }
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

// Migrate tenant to new URL structure (adds client, updates medusa routing)
export async function migrateTenant(tenantId: string): Promise<Tenant> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  if (tenant.status !== "running" && tenant.status !== "stopped") {
    throw new Error(`Cannot migrate tenant in status: ${tenant.status}`);
  }

  await logEvent(tenantId, "service_updating", "Migrating tenant to new URL structure");

  const config = tenant.config as TenantConfig;
  const networkName = `tenant_${tenant.slug}_network`;

  // Find existing resources
  const medusaResource = tenant.resources.find((r) => r.resourceType === "medusa");
  const clientResource = tenant.resources.find((r) => r.resourceType === "client");
  const postgresResource = tenant.resources.find((r) => r.resourceType === "postgres");
  const redisResource = tenant.resources.find((r) => r.resourceType === "redis");

  if (!medusaResource?.containerId) {
    throw new Error("Medusa container not found - cannot migrate");
  }

  try {
    // Step 1: Recreate Medusa container with new store.{subdomain} routing
    await logEvent(tenantId, "service_updating", "Updating Medusa routing to store subdomain");

    // The createMedusaContainer function checks labels and recreates if wrong
    const medusa = await dockerService.createMedusaContainer(
      tenant,
      networkName,
      {
        containerId: postgresResource?.containerId || "",
        containerName: postgresResource?.containerName || "",
        status: "running",
        port: postgresResource?.port || undefined,
      },
      {
        containerId: redisResource?.containerId || "",
        containerName: redisResource?.containerName || "",
        status: "running",
        port: redisResource?.port || undefined,
      },
      config.medusaPort || 9000,
      config.adminPort || 5173,
      tenant.imageTag || undefined
    );

    // Update medusa resource if container ID changed
    if (medusa.containerId !== medusaResource.containerId) {
      await db
        .update(tenantResources)
        .set({
          containerId: medusa.containerId,
          containerName: medusa.containerName,
          status: "running",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tenantResources.tenantId, tenantId),
            eq(tenantResources.resourceType, "medusa")
          )
        );
    }

    // Step 2: Create client container if it doesn't exist
    if (!clientResource) {
      await logEvent(tenantId, "service_updating", "Creating client container");

      // Allocate a new port for client
      const ports = dockerService.allocatePorts();

      const client = await dockerService.createClientContainer(
        tenant,
        networkName,
        ports.client
      );

      // Insert new client resource
      await db.insert(tenantResources).values({
        tenantId,
        resourceType: "client",
        containerId: client.containerId,
        containerName: client.containerName,
        status: "running",
        port: client.port,
      });

      await logEvent(tenantId, "client_created", "Client container created");

      // Update tenant config with client port
      await db
        .update(tenants)
        .set({
          config: {
            ...config,
            clientPort: ports.client,
          },
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));
    } else if (clientResource.containerId) {
      // Client exists, just restart it
      const exists = await containerExists(clientResource.containerId);
      if (exists) {
        await dockerService.restartContainer(clientResource.containerId);
      }
    }

    const [updatedTenant] = await db
      .update(tenants)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();

    await logEvent(tenantId, "provisioning_completed", "Migration to new URL structure complete");

    return updatedTenant;
  } catch (error) {
    await logEvent(
      tenantId,
      "failed",
      `Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      { error: String(error) }
    );
    throw error;
  }
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

    // Verify containers exist
    const postgresExists = await containerExists(postgresResource.containerId);
    const redisExists = await containerExists(redisResource.containerId);

    if (!postgresExists || !redisExists) {
      throw new Error("Required containers (postgres/redis) are missing. Please restart the tenant first to recreate them.");
    }

    const networkName = `tenant_${tenant.slug}_network`;
    const config = tenant.config as TenantConfig;

    // Stop and remove the old medusa container (if it exists)
    const medusaExists = await containerExists(medusaResource.containerId);
    if (medusaExists) {
      await dockerService.removeContainer(medusaResource.containerId);
    }

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
  const order = ["client", "medusa", "redis", "postgres"];
  for (const resourceType of order) {
    const resource = tenant.resources.find((r) => r.resourceType === resourceType);
    if (resource?.containerId) {
      try {
        const exists = await containerExists(resource.containerId);
        if (exists) {
          await dockerService.removeContainer(resource.containerId);
        } else {
          console.log(`Container ${resource.containerId} for ${resourceType} not found, skipping removal`);
        }
      } catch (error) {
        console.error(`Failed to remove ${resourceType} container:`, error);
        // Continue with cleanup even if container removal fails
      }
    }
  }

  // Remove network
  const networkResource = tenant.resources.find((r) => r.resourceType === "network");
  if (networkResource?.networkId) {
    try {
      await dockerService.removeNetwork(networkResource.networkId);
    } catch (error) {
      console.error("Failed to remove network:", error);
      // Continue with cleanup even if network removal fails
    }
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

  const exists = await containerExists(resource.containerId);
  if (!exists) {
    throw new Error(`Container for ${service} no longer exists. Try restarting the tenant to recreate it.`);
  }

  return dockerService.getContainerLogs(resource.containerId, tail);
}

// Get tenant health/stats
export async function getTenantHealth(tenantId: string): Promise<{
  status: string;
  containers: Record<string, { status: string; stats?: { cpu: number; memory: number }; missing?: boolean }>;
}> {
  const tenant = await getTenant(tenantId);
  if (!tenant) throw new Error("Tenant not found");

  const containers: Record<string, { status: string; stats?: { cpu: number; memory: number }; missing?: boolean }> = {};

  for (const resource of tenant.resources) {
    if (resource.containerId) {
      const status = await dockerService.getContainerStatus(resource.containerId);

      if (status === "not_found") {
        containers[resource.resourceType] = { status: "missing", missing: true };
        continue;
      }

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
    } else if (resource.resourceType !== "network") {
      containers[resource.resourceType] = { status: "not_provisioned", missing: true };
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
