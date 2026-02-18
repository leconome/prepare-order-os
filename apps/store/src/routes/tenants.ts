import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { updateTenantSettingsSchema } from "@prepareos/data";
import * as tenantService from "../services/tenant.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const tenantsRoute = new Hono<AppEnv>();

// GET /api/tenants — return current tenant info (public, no auth needed)
tenantsRoute.get("/", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const tenant = await tenantService.getTenant(tenantId);

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
    const tenant = await tenantService.updateTenantSettings(tenantId, data);
    return c.json(tenant);
  },
);

export default tenantsRoute;
