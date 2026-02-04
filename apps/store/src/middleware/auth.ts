import type { Context, MiddlewareHandler, Next } from "hono";
import { auth } from "../lib/auth.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
};

export type AuthVariables = {
  user: AuthUser;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
};

export const authMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = session.user as Record<string, unknown>;
  c.set("user", {
    id: user.id as string,
    email: user.email as string,
    name: (user.name as string | null) ?? null,
    role: (user.role as string) ?? "cashier",
  } satisfies AuthUser);
  c.set("session", session.session);

  await next();
};

export const optionalAuthMiddleware: MiddlewareHandler = async (c: Context, next: Next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session) {
    const user = session.user as Record<string, unknown>;
    c.set("user", {
      id: user.id as string,
      email: user.email as string,
      name: (user.name as string | null) ?? null,
      role: (user.role as string) ?? "cashier",
    } satisfies AuthUser);
    c.set("session", session.session);
  }

  await next();
};
