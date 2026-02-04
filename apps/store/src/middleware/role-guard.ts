import type { Context, MiddlewareHandler, Next } from "hono";
import type { AuthUser } from "./auth.js";

// Unified role types: admin (devs), owner (store owners), staff (employees)
type Role = "admin" | "owner" | "staff";

export const roleGuard = (...allowedRoles: Role[]): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as AuthUser | undefined;

    if (!user?.role) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!allowedRoles.includes(user.role as Role)) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    await next();
  };
};

// Role guards
export const adminOnly = roleGuard("admin");
export const ownerOrAdmin = roleGuard("admin", "owner");
export const allAuthenticated = roleGuard("admin", "owner", "staff");
