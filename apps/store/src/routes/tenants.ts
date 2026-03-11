import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { updateTenantSettingsSchema } from "@prepareos/data";
import * as tenantService from "../services/tenant.service.js";
import * as wooSyncService from "../services/woo-sync.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const tenantsRoute = new Hono<AppEnv>();

// GET /api/tenants — return current tenant info
tenantsRoute.get("/", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const tenant = await tenantService.getTenantPublic(tenantId);

  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  return c.json(tenant);
});

// PATCH /api/tenants/settings — update tenant settings (owner/admin only)
tenantsRoute.patch(
  "/settings",
  authMiddleware,
  ownerOrAdmin,
  zValidator("json", updateTenantSettingsSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const updated = await tenantService.updateTenantSettings(tenantId, data);
    return c.json(updated);
  },
);

// POST /api/tenants/api-key/generate — generate a new API key (owner/admin only)
tenantsRoute.post(
  "/api-key/generate",
  authMiddleware,
  ownerOrAdmin,
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const result = await tenantService.generateApiKey(tenantId);
    return c.json(result);
  },
);

// POST /api/tenants/sync/categories — push categories to WooCommerce (owner/admin only)
tenantsRoute.post(
  "/sync/categories",
  authMiddleware,
  ownerOrAdmin,
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    try {
      const result = await wooSyncService.pushCategoriesToWoo(tenantId);
      return c.json({ ok: true, created: result.created, updated: result.updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de synchronisation.";
      return c.json({ error: message }, 400);
    }
  },
);

// POST /api/tenants/sync/attributes — push attributes to WooCommerce (owner/admin only)
tenantsRoute.post(
  "/sync/attributes",
  authMiddleware,
  ownerOrAdmin,
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    try {
      const result = await wooSyncService.pushAttributesToWoo(tenantId);
      return c.json({ ok: true, created: result.created, updated: result.updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de synchronisation.";
      return c.json({ error: message }, 400);
    }
  },
);

// POST /api/tenants/sync/products — push products to WooCommerce (owner/admin only)
tenantsRoute.post(
  "/sync/products",
  authMiddleware,
  ownerOrAdmin,
  async (c) => {
    const tenantId = c.get("tenantId") as string;

    try {
      const result = await wooSyncService.pushProductsToWoo(tenantId);
      return c.json({ ok: true, created: result.created, updated: result.updated });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erreur de synchronisation.";
      return c.json({ error: message }, 400);
    }
  },
);

export default tenantsRoute;
