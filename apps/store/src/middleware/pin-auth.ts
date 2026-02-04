import type { Context, MiddlewareHandler, Next } from "hono";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "@prepareos/data";
import type { AuthUser } from "./auth.js";

/**
 * PIN authentication middleware for staff users.
 * Allows staff to authenticate with a 4-digit PIN instead of email/password.
 * Sets the same "user" context as regular auth middleware.
 */
export const pinAuthMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const pin = c.req.header("X-Staff-PIN");

  if (!pin) {
    return c.json({ error: "PIN required" }, 401);
  }

  if (!/^\d{4}$/.test(pin)) {
    return c.json({ error: "Invalid PIN format" }, 401);
  }

  const user = await db.query.users.findFirst({
    where: and(
      eq(users.pin, pin),
      eq(users.isActive, true),
      isNotNull(users.pin),
    ),
  });

  if (!user) {
    return c.json({ error: "Invalid PIN" }, 401);
  }

  c.set("user", {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  } satisfies AuthUser);

  await next();
};

/**
 * Optional PIN auth - checks for PIN but doesn't require it.
 * Useful for endpoints that can work with either auth method.
 */
export const optionalPinAuthMiddleware: MiddlewareHandler = async (
  c: Context,
  next: Next,
) => {
  const pin = c.req.header("X-Staff-PIN");

  if (pin && /^\d{4}$/.test(pin)) {
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.pin, pin),
        eq(users.isActive, true),
        isNotNull(users.pin),
      ),
    });

    if (user) {
      c.set("user", {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      } satisfies AuthUser);
    }
  }

  await next();
};
