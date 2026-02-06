import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenants, type Tenant } from "@prepareos/data";

export type TenantVariables = {
  tenant: Tenant;
  tenantId: string;
};

export const tenantMiddleware: MiddlewareHandler = async (c, next) => {
  // 1. Try subdomain extraction from Host header
  const host = c.req.header("host") ?? "";
  const hostname = host.split(":")[0]; // strip port
  const parts = hostname.split(".");
  let slug: string | undefined;

  if (parts.length >= 3) {
    // e.g. fromagerie.prepareos.com → slug = "fromagerie"
    slug = parts[0];
  }

  // 2. Fallback to DEV_TENANT_SLUG for local development
  if (!slug) {
    slug = process.env.DEV_TENANT_SLUG;
  }

  if (!slug) {
    return c.json(
      { error: "Unable to determine tenant. Set DEV_TENANT_SLUG for local development." },
      400,
    );
  }

  // 3. Look up tenant in DB
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });

  if (!tenant) {
    return c.json({ error: `Tenant not found: ${slug}` }, 404);
  }

  c.set("tenant", tenant);
  c.set("tenantId", tenant.id);

  await next();
};
