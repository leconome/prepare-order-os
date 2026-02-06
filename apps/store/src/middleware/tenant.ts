import type { MiddlewareHandler } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenants, type Tenant } from "@prepareos/data";

export type TenantVariables = {
  tenant: Tenant;
  tenantId: string;
};

const baseDomain = process.env.BASE_DOMAIN; // e.g. "up.railway.app" or "localhost"
const baseParts = baseDomain ? baseDomain.split(".").length : 0;

export const tenantMiddleware: MiddlewareHandler = async (c, next) => {
  let slug: string | undefined;

  // In dev stage, use DEV_TENANT_SLUG directly (local + deployed dev)
  if (process.env.STAGE === "dev" && process.env.DEV_TENANT_SLUG) {
    slug = process.env.DEV_TENANT_SLUG;
  } else {
    // Production: extract subdomain from Host header
    const host = c.req.header("host") ?? "";
    const hostname = host.split(":")[0]; // strip port
    const parts = hostname.split(".");

    // If BASE_DOMAIN is set, extract slug when hostname has more parts than the base
    // e.g. "fromagerie.up.railway.app" (4 parts) vs "up.railway.app" (3 parts)
    if (baseParts > 0 && parts.length > baseParts) {
      slug = parts[0];
    } else if (parts.length >= 3) {
      // Standard subdomain (e.g. fromagerie.prepareos.com)
      slug = parts[0];
    }
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
