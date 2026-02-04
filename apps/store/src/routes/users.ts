import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";

const usersRoutes = new Hono();

// Check if a user exists by email (for dev mode only)
usersRoutes.get("/check/:email", async (c) => {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const email = c.req.param("email");

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  return c.json({ exists: !!user, user: user ?? null });
});

export default usersRoutes;
