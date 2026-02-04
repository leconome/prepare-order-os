import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "@prepareos/data/schema";
import {
  staffFiltersSchema,
  createStaffSchema,
  updateStaffSchema,
} from "@prepareos/data";
import { auth } from "../lib/auth.js";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import { nanoid } from "nanoid";

const usersRoutes = new Hono();

// Require authentication for all routes
usersRoutes.use("*", authMiddleware);

// List all users (for admin/owner)
usersRoutes.get("/", async (c) => {
  const allUsers = await db.query.users.findMany({
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({ users: allUsers });
});

// List staff users (for assigning to orders, etc.)
usersRoutes.get(
  "/staff",
  zValidator("query", staffFiltersSchema),
  async (c) => {
    const { role, isActive, page = 1, limit = 20 } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [];

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.query.users.findMany({
        where: whereClause,
        limit,
        offset,
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: (users, { asc }) => [asc(users.name)],
      }),
      db.select({ count: sql<number>`count(*)` }).from(users).where(whereClause),
    ]);

    const total = Number(countResult[0]?.count ?? 0);

    return c.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  },
);

// Get user by ID
usersRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");

  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
    columns: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json(user);
});

// Create a user with email/password (admin endpoint)
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  role: z.enum(["admin", "owner", "staff"]).optional(),
});

usersRoutes.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createUserSchema),
  async (c) => {
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

      // Update role if specified (default is staff)
      if (role && role !== "staff") {
        await db
          .update(users)
          .set({ role })
          .where(eq(users.id, result.user.id));
      }

      // Fetch the updated user
      const user = await db.query.users.findFirst({
        where: eq(users.id, result.user.id),
        columns: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      return c.json({ user }, 201);
    } catch (error) {
      console.error("Failed to create user:", error);
      return c.json({ error: "Failed to create user" }, 500);
    }
  },
);

// Create a staff user with PIN (simpler flow for store employees)
usersRoutes.post(
  "/staff",
  ownerOrAdmin,
  zValidator("json", createStaffSchema),
  async (c) => {
    const { name, email, pin, role, isActive } = c.req.valid("json");

    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      return c.json({ error: "User with this email already exists" }, 409);
    }

    // Check if PIN is already in use
    const existingPin = await db.query.users.findFirst({
      where: eq(users.pin, pin),
    });

    if (existingPin) {
      return c.json({ error: "PIN is already in use" }, 409);
    }

    // Create staff user directly (no password, uses PIN)
    const [user] = await db
      .insert(users)
      .values({
        id: nanoid(),
        name,
        email,
        pin,
        role: role || "staff",
        isActive: isActive ?? true,
        emailVerified: false,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return c.json(user, 201);
  },
);

// Update a user
usersRoutes.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updateStaffSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
    });

    if (!existing) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if new PIN is already in use by another user
    if (data.pin) {
      const existingPin = await db.query.users.findFirst({
        where: and(eq(users.pin, data.pin)),
      });

      if (existingPin && existingPin.id !== id) {
        return c.json({ error: "PIN is already in use" }, 409);
      }
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.pin !== undefined) updateData.pin = data.pin;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return c.json(user);
  },
);

// Delete a user
usersRoutes.delete("/:id", ownerOrAdmin, async (c) => {
  const id = c.req.param("id");

  const existing = await db.query.users.findFirst({
    where: eq(users.id, id),
  });

  if (!existing) {
    return c.json({ error: "User not found" }, 404);
  }

  await db.delete(users).where(eq(users.id, id));

  return c.json({ success: true });
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
