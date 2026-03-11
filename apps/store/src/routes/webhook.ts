import { Hono } from "hono";
import { apiKeyMiddleware } from "../middleware/api-key.js";
import type { AppEnv } from "../types.js";

const webhookRoutes = new Hono<AppEnv>();

// All webhook routes require API key auth
webhookRoutes.use("*", apiKeyMiddleware);

// GET /api/webhook/ping — verify API key works
webhookRoutes.get("/ping", async (c) => {
  const tenantId = c.get("tenantId") as string;
  return c.json({ ok: true, tenantId });
});

// POST /api/webhook/woo/order — receive WooCommerce order (stage 2)
// webhookRoutes.post("/woo/order", async (c) => { ... });

export default webhookRoutes;
