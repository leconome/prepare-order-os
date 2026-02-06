import { Hono } from "hono";
import { tenants } from "@prepareos/data";
import { db } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { adminOnly } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const admin = new Hono<AppEnv>();

admin.use("*", authMiddleware);
admin.use("*", adminOnly);

// GET /api/admin/tenants — list all tenants (admin only)
admin.get("/tenants", async (c) => {
  const allTenants = await db
    .select()
    .from(tenants)
    .orderBy(tenants.createdAt);

  return c.json({ data: allTenants });
});

export default admin;
