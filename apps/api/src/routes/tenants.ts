import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import * as tenantService from "../services/tenant.js";

const tenants = new Hono();

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  subdomain: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Subdomain must be lowercase alphanumeric with hyphens"),
  adminEmail: z.string().email().optional(),
  adminPassword: z.string().min(8).optional(),
  config: z
    .object({
      storeCors: z.string().optional(),
      adminCors: z.string().optional(),
      environment: z.record(z.string()).optional(),
    })
    .optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  adminEmail: z.string().email().optional(),
  config: z
    .object({
      storeCors: z.string().optional(),
      adminCors: z.string().optional(),
      environment: z.record(z.string()).optional(),
    })
    .optional(),
});

// GET /tenants - List all tenants
tenants.get("/", async (c) => {
  try {
    const allTenants = await tenantService.listTenants();
    return c.json({ tenants: allTenants });
  } catch (error) {
    console.error("Error listing tenants:", error);
    return c.json({ error: "Failed to list tenants" }, 500);
  }
});

// GET /tenants/:id - Get tenant details
tenants.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const tenant = await tenantService.getTenant(id);

    if (!tenant) {
      return c.json({ error: "Tenant not found" }, 404);
    }

    return c.json({ tenant });
  } catch (error) {
    console.error("Error getting tenant:", error);
    return c.json({ error: "Failed to get tenant" }, 500);
  }
});

// POST /tenants - Create new tenant
tenants.post("/", zValidator("json", createTenantSchema), async (c) => {
  try {
    const input = c.req.valid("json");

    // Check if slug already exists
    const existing = await tenantService.getTenantBySlug(input.slug);
    if (existing) {
      return c.json({ error: "Slug already in use" }, 409);
    }

    const tenant = await tenantService.createTenant(input);
    return c.json({ tenant }, 201);
  } catch (error) {
    console.error("Error creating tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to create tenant" },
      500
    );
  }
});

// POST /tenants/:id/provision - Provision tenant containers
tenants.post("/:id/provision", async (c) => {
  try {
    const id = c.req.param("id");
    const tenant = await tenantService.provisionTenant(id);
    return c.json({ tenant });
  } catch (error) {
    console.error("Error provisioning tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to provision tenant" },
      500
    );
  }
});

// PATCH /tenants/:id - Update tenant
tenants.patch("/:id", zValidator("json", updateTenantSchema), async (c) => {
  try {
    const id = c.req.param("id");
    const updates = c.req.valid("json");

    const tenant = await tenantService.updateTenant(id, updates);
    return c.json({ tenant });
  } catch (error) {
    console.error("Error updating tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to update tenant" },
      500
    );
  }
});

// POST /tenants/:id/start - Start tenant containers
tenants.post("/:id/start", async (c) => {
  try {
    const id = c.req.param("id");
    const tenant = await tenantService.startTenant(id);
    return c.json({ tenant });
  } catch (error) {
    console.error("Error starting tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to start tenant" },
      500
    );
  }
});

// POST /tenants/:id/stop - Stop tenant containers
tenants.post("/:id/stop", async (c) => {
  try {
    const id = c.req.param("id");
    const tenant = await tenantService.stopTenant(id);
    return c.json({ tenant });
  } catch (error) {
    console.error("Error stopping tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to stop tenant" },
      500
    );
  }
});

// POST /tenants/:id/restart - Restart tenant containers
tenants.post("/:id/restart", async (c) => {
  try {
    const id = c.req.param("id");
    const tenant = await tenantService.restartTenant(id);
    return c.json({ tenant });
  } catch (error) {
    console.error("Error restarting tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to restart tenant" },
      500
    );
  }
});

// DELETE /tenants/:id - Delete tenant
tenants.delete("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await tenantService.deleteTenant(id);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting tenant:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete tenant" },
      500
    );
  }
});

// GET /tenants/:id/logs - Get tenant logs
tenants.get("/:id/logs", async (c) => {
  try {
    const id = c.req.param("id");
    const service = (c.req.query("service") as "medusa" | "postgres" | "redis") || "medusa";
    const tail = parseInt(c.req.query("tail") || "100", 10);

    const logs = await tenantService.getTenantLogs(id, service, tail);
    return c.json({ logs });
  } catch (error) {
    console.error("Error getting logs:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get logs" },
      500
    );
  }
});

// GET /tenants/:id/health - Get tenant health status
tenants.get("/:id/health", async (c) => {
  try {
    const id = c.req.param("id");
    const health = await tenantService.getTenantHealth(id);
    return c.json(health);
  } catch (error) {
    console.error("Error getting health:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get health" },
      500
    );
  }
});

// GET /tenants/:id/events - Get tenant events
tenants.get("/:id/events", async (c) => {
  try {
    const id = c.req.param("id");
    const limit = parseInt(c.req.query("limit") || "50", 10);

    const events = await tenantService.getTenantEvents(id, limit);
    return c.json({ events });
  } catch (error) {
    console.error("Error getting events:", error);
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to get events" },
      500
    );
  }
});

export default tenants;
