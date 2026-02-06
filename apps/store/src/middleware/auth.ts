import type { Context, MiddlewareHandler, Next } from "hono";
import { auth } from "../lib/auth.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string;
};

export type AuthVariables = {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
};

export const authMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const cookieHeader = c.req.header("cookie");
  console.log("[auth] Request:", c.req.method, c.req.path);
  console.log("[auth] Cookie header:", cookieHeader ? cookieHeader.slice(0, 80) + "..." : "NONE");

  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  console.log("[auth] Session result:", session ? { userId: session.user?.id, sessionId: session.session?.id } : "NULL");

  if (!session) {
    console.log("[auth] REJECTED - no valid session found");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = session.user as Record<string, unknown>;
  const userTenantId = user.tenantId as string;

  // Cross-tenant guard: user must belong to the current tenant
  const currentTenantId = c.get("tenantId") as string | undefined;
  if (currentTenantId && userTenantId !== currentTenantId) {
    return c.json({ error: "Forbidden: tenant mismatch" }, 403);
  }

  c.set("user", {
    id: user.id as string,
    email: user.email as string,
    name: (user.name as string | null) ?? null,
    role: (user.role as string) ?? "staff",
    tenantId: userTenantId,
  } satisfies AuthUser);
  c.set("session", session.session);

  await next();
};

export const optionalAuthMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session) {
    const user = session.user as Record<string, unknown>;
    const userTenantId = user.tenantId as string;

    const currentTenantId = c.get("tenantId") as string | undefined;
    if (currentTenantId && userTenantId !== currentTenantId) {
      return c.json({ error: "Forbidden: tenant mismatch" }, 403);
    }

    c.set("user", {
      id: user.id as string,
      email: user.email as string,
      name: (user.name as string | null) ?? null,
      role: (user.role as string) ?? "staff",
      tenantId: userTenantId,
    } satisfies AuthUser);
    c.set("session", session.session);
  }

  await next();
};
