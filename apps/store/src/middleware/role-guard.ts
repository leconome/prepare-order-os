import type { Context, MiddlewareHandler, Next } from "hono";
import type { AuthUser } from "./auth.js";
import type { EmployeeContext } from "./pin-auth.js";

type Role = "admin" | "manager" | "cashier" | "kitchen";

export const roleGuard = (...allowedRoles: Role[]): MiddlewareHandler => {
  return async (c: Context, next: Next) => {
    const user = c.get("user") as AuthUser | undefined;
    const employee = c.get("employee") as EmployeeContext | undefined;

    const role = user?.role || employee?.role;

    if (!role) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!allowedRoles.includes(role as Role)) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    await next();
  };
};

export const adminOnly = roleGuard("admin");
export const managerOrAdmin = roleGuard("admin", "manager");
export const cashierAccess = roleGuard("admin", "manager", "cashier");
export const kitchenAccess = roleGuard("admin", "manager", "kitchen");
export const allStaff = roleGuard("admin", "manager", "cashier", "kitchen");
