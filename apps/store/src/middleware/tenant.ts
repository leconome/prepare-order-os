import { type Tenant, tenants } from "@prepareos/data";
import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import { db } from "../db/index.js";

export type TenantVariables = {
  tenant: Tenant;
  tenantId: string;
};

const baseDomain = process.env.BASE_DOMAIN; // e.g. "prepareos.fr"
const baseParts = baseDomain ? baseDomain.split(".").length : 0;

// Subdomains that are platform infrastructure, not tenants
const RESERVED_SUBDOMAINS = new Set(["api", "admin", "www"]);

/**
 * Extract tenant slug from a hostname.
 * Returns undefined if the hostname is a reserved subdomain or has no subdomain.
 */
function extractSlug(hostname: string): string | undefined {
  const clean = hostname.split(":")[0]; // strip port
  const parts = clean.split(".");

  let candidate: string | undefined;

  if (baseParts > 0 && parts.length > baseParts) {
    candidate = parts[0];
  } else if (parts.length >= 3) {
    candidate = parts[0];
  }

  if (candidate && RESERVED_SUBDOMAINS.has(candidate)) return undefined;

  return candidate;
}

export const tenantMiddleware: MiddlewareHandler = async (c, next) => {
  let slug: string | undefined;

  // In dev stage, check header override first, then fall back to DEV_TENANT_SLUG
  if (process.env.STAGE === "dev") {
    slug = c.req.header("x-dev-tenant") || process.env.DEV_TENANT_SLUG;
  } else {
    // 1. Try Origin header (cross-origin requests from client)
    //    e.g. Origin: https://fromagerie.prepareos.fr
    const origin = c.req.header("origin");
    if (origin) {
      try {
        const url = new URL(origin);
        slug = extractSlug(url.hostname);
      } catch {
        // invalid origin, skip
      }
    }

    // 2. Fallback to Referer header (some GET requests)
    if (!slug) {
      const referer = c.req.header("referer");
      if (referer) {
        try {
          const url = new URL(referer);
          slug = extractSlug(url.hostname);
        } catch {
          // invalid referer, skip
        }
      }
    }

    // 3. Fallback to Host header (direct API access / same-origin)
    if (!slug) {
      slug = extractSlug(c.req.header("host") ?? "");
    }
  }

  if (!slug) {
    return c.json(
      {
        error:
          "Unable to determine tenant. Set DEV_TENANT_SLUG for local development.",
      },
      400,
    );
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });

  console.log(
    `Tenant middleware: slug=${slug}, tenant=${tenant ? tenant.name : "not found"}`,
  );

  if (!tenant) {
    return c.json({ error: `Tenant not found: ${slug}` }, 404);
  }

  c.set("tenant", tenant);
  c.set("tenantId", tenant.id);

  await next();
};
