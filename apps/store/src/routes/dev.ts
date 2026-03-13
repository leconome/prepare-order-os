import { users } from "@prepareos/data/schema";
import { tenants } from "@prepareos/data";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";

const devRoutes = new Hono();

// Check if a user exists by email (optionally scoped by tenant slug)
devRoutes.get("/check/:email", async (c) => {
  const email = c.req.param("email");
  const tenantSlug = c.req.query("tenant");

  let tenantId: string | undefined;
  if (tenantSlug) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, tenantSlug),
    });
    if (!tenant) {
      return c.json({ exists: false, user: null });
    }
    tenantId = tenant.id;
  }

  const conditions = [eq(users.email, email)];
  if (tenantId) {
    conditions.push(eq(users.tenantId, tenantId));
  }

  const user = await db.query.users.findFirst({
    where: and(...conditions),
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return c.json({ exists: !!user, user: user ?? null });
});

// Create dev user (optionally with tenant)
devRoutes.post("/signup", async (c) => {
  const { email, password, name, role, tenantSlug } = await c.req.json();

  let tenantId: string | undefined;
  if (tenantSlug) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, tenantSlug),
    });
    if (!tenant) {
      return c.json({ error: `Tenant not found: ${tenantSlug}` }, 404);
    }
    tenantId = tenant.id;
  }

  const result = await auth.api.signUpEmail({
    body: { email, password, name, tenantId },
  });

  if (!result.user) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  const updateFields: Record<string, unknown> = {};
  if (tenantId) updateFields.tenantId = tenantId;
  if (role && role !== "staff") updateFields.role = role;

  if (Object.keys(updateFields).length > 0) {
    await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, result.user.id));
  }

  return c.json({ user: { ...result.user, role: role || "staff" } }, 201);
});

export default devRoutes;
