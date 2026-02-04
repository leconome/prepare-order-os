import type { Context, MiddlewareHandler, Next } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../db/index.js";
import { employees } from "../db/schema/index.js";

export type EmployeeContext = {
  id: string;
  name: string;
  role: string;
};

export type PinAuthVariables = {
  employee: EmployeeContext;
};

export const pinAuthMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const pin = c.req.header("X-Employee-PIN");

  if (!pin) {
    return c.json({ error: "PIN required" }, 401);
  }

  if (!/^\d{4}$/.test(pin)) {
    return c.json({ error: "Invalid PIN format" }, 401);
  }

  const employee = await db.query.employees.findFirst({
    where: and(
      eq(employees.pin, pin),
      eq(employees.isActive, true)
    ),
  });

  if (!employee) {
    return c.json({ error: "Invalid PIN" }, 401);
  }

  c.set("employee", {
    id: employee.id,
    name: employee.name,
    role: employee.role,
  } satisfies EmployeeContext);

  await next();
};

export const optionalPinAuthMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const pin = c.req.header("X-Employee-PIN");

  if (pin && /^\d{4}$/.test(pin)) {
    const employee = await db.query.employees.findFirst({
      where: and(
        eq(employees.pin, pin),
        eq(employees.isActive, true)
      ),
    });

    if (employee) {
      c.set("employee", {
        id: employee.id,
        name: employee.name,
        role: employee.role,
      } satisfies EmployeeContext);
    }
  }

  await next();
};
