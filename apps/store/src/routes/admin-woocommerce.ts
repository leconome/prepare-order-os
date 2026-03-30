import { zValidator } from "@hono/zod-validator";
import {
  connectWooCommerceSchema,
  toggleWooCommerceSchema,
} from "@prepareos/data";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { adminOnly } from "../middleware/role-guard.js";
import * as wcService from "../services/woocommerce.service.js";
import type { AppEnv } from "../types.js";

const router = new Hono<AppEnv>();

router.use("*", authMiddleware);
router.use("*", adminOnly);

// GET /api/admin/tenants/:tenantId/woocommerce — connection status
router.get("/:tenantId/woocommerce", async (c) => {
  const tenantId = c.req.param("tenantId");
  const connection = await wcService.getConnection(tenantId);
  return c.json({ data: connection });
});

// POST /api/admin/tenants/:tenantId/woocommerce/connect — create connection
router.post(
  "/:tenantId/woocommerce/connect",
  zValidator("json", connectWooCommerceSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const data = c.req.valid("json");

    const apiHost =
      process.env.PUBLIC_API_URL ||
      `${c.req.header("X-Forwarded-Proto") || "https"}://${c.req.header("Host")}`;

    try {
      const connection = await wcService.connect(tenantId, data, apiHost);
      return c.json({ data: connection }, 201);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Connection failed";
      console.error("[WC Connect Error]", error);
      return c.json({ error: message }, 500);
    }
  },
);

// POST /api/admin/tenants/:tenantId/woocommerce/disconnect — disconnect
router.post("/:tenantId/woocommerce/disconnect", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    await wcService.disconnect(tenantId);
    return c.json({ data: { disconnected: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Disconnect failed";
    console.error("[WC Disconnect Error]", error);
    return c.json({ error: message }, 500);
  }
});

// PATCH /api/admin/tenants/:tenantId/woocommerce/toggle — toggle isEnabled
router.patch(
  "/:tenantId/woocommerce/toggle",
  zValidator("json", toggleWooCommerceSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const { isEnabled } = c.req.valid("json");

    const updated = await wcService.toggleConnection(tenantId, isEnabled);
    if (!updated) {
      return c.json({ error: "Connection not found" }, 404);
    }
    return c.json({ data: updated });
  },
);

// POST /api/admin/tenants/:tenantId/woocommerce/sync — manual sync (backfill)
router.post("/:tenantId/woocommerce/sync", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    const result = await wcService.backfill(tenantId);
    return c.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    console.error("[WC Sync Error]", error);
    return c.json({ error: message }, 500);
  }
});

// POST /api/admin/tenants/:tenantId/woocommerce/backfill — backfill
router.post("/:tenantId/woocommerce/backfill", async (c) => {
  const tenantId = c.req.param("tenantId");

  try {
    const result = await wcService.backfill(tenantId);
    return c.json({ data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Backfill failed";
    console.error("[WC Backfill Error]", error);
    return c.json({ error: message }, 500);
  }
});

// GET /api/admin/tenants/:tenantId/woocommerce/health — liveness check
router.get("/:tenantId/woocommerce/health", async (c) => {
  const tenantId = c.req.param("tenantId");
  const health = await wcService.getHealth(tenantId);

  if (!health) {
    return c.json({ error: "No WooCommerce connection found" }, 404);
  }
  return c.json({ data: health });
});

// GET /api/admin/tenants/:tenantId/woocommerce/logs — recent sync logs
router.get("/:tenantId/woocommerce/logs", async (c) => {
  const tenantId = c.req.param("tenantId");
  const logs = await wcService.getLogs(tenantId);
  return c.json({ data: logs });
});

export default router;
