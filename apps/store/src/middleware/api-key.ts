import type { MiddlewareHandler } from "hono";
import { verifyApiKey, touchApiKeyLastUsed } from "../services/tenant.service.js";

export const apiKeyMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("authorization");

  if (!authHeader?.startsWith("Bearer sk_")) {
    return c.json({ error: "Invalid or missing API key" }, 401);
  }

  const key = authHeader.slice(7); // Remove "Bearer "
  const tenant = await verifyApiKey(key);

  if (!tenant) {
    return c.json({ error: "Invalid API key" }, 401);
  }

  c.set("tenant", tenant);
  c.set("tenantId", tenant.id);
  c.set("user", {
    id: `api:${tenant.id}`,
    email: "api@external",
    name: "API",
    role: "api",
    tenantId: tenant.id,
  });

  // Update last used timestamp (fire-and-forget)
  touchApiKeyLastUsed(tenant.id).catch(() => {});

  await next();
};
