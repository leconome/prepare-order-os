import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, accounts } from "@prepareos/data/schema";
import { auth } from "../lib/auth.js";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const usersRoutes = new Hono();

// List all users (protected - requires authentication)
usersRoutes.get("/", async (c) => {
  const allUsers = await db.query.users.findMany({
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({ users: allUsers });
});

// Create a user (admin endpoint for platform)
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(["admin", "manager", "cashier", "kitchen"]).optional(),
});

usersRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  const { email, password, name, role } = c.req.valid("json");

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    return c.json({ error: "User with this email already exists" }, 409);
  }

  // Create user through BetterAuth's internal API
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: name || email.split("@")[0],
      },
    });

    if (!result.user) {
      return c.json({ error: "Failed to create user" }, 500);
    }

    // Update role if specified
    if (role && role !== "cashier") {
      await db.update(users).set({ role }).where(eq(users.id, result.user.id));
    }

    // Fetch the updated user
    const user = await db.query.users.findFirst({
      where: eq(users.id, result.user.id),
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return c.json({ user }, 201);
  } catch (error) {
    console.error("Failed to create user:", error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

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
