import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { tenants, wooCategorySyncSchema } from "@prepareos/data";
import { apiKeyMiddleware } from "../middleware/api-key.js";
import { db } from "../db/index.js";
import * as categoryService from "../services/category.service.js";
import type { AppEnv } from "../types.js";

const webhookRoutes = new Hono<AppEnv>();

// All webhook routes require API key auth
webhookRoutes.use("*", apiKeyMiddleware);

// GET /api/webhook/ping — verify API key works
webhookRoutes.get("/ping", async (c) => {
  const tenantId = c.get("tenantId") as string;
  return c.json({ ok: true, tenantId });
});

// POST /api/webhook/register — WordPress plugin registers itself
webhookRoutes.post("/register", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const body = await c.req.json<{ siteUrl?: string; siteName?: string }>();

  const wooUrl = body.siteUrl || null;

  await db
    .update(tenants)
    .set({ wooUrl, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return c.json({ ok: true, registered: true });
});

// POST /api/webhook/sync/categories — receive WooCommerce categories
webhookRoutes.post(
  "/sync/categories",
  zValidator("json", wooCategorySyncSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const { categories } = c.req.valid("json");

    const result = await categoryService.syncWooCategories(
      tenantId,
      categories,
    );

    return c.json({
      ok: true,
      created: result.created,
      updated: result.updated,
    });
  },
);

export default webhookRoutes;
