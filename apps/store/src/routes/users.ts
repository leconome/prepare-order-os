import crypto from "crypto";
import { zValidator } from "@hono/zod-validator";
import {
  createStaffSchema,
  pinLoginSchema,
  staffFiltersSchema,
  updateStaffSchema,
} from "@prepareos/data";
import { sessions, users } from "@prepareos/data/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";

const usersRoutes = new Hono();

// Check if a user exists by email (for dev mode only - no auth required)
usersRoutes.get("/check/:email", async (c) => {
  // Only allow in dev stage
  const stage = process.env.STAGE;

  if (stage !== "dev") {
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

// Create dev user with role (dev mode only - no auth required)
usersRoutes.post("/dev-signup", async (c) => {
  if (process.env.STAGE !== "dev") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const { email, password, name, role } = await c.req.json();

  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  if (!result.user) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  if (role && role !== "staff") {
    await db.update(users).set({ role }).where(eq(users.id, result.user.id));
  }

  return c.json({ user: { ...result.user, role: role || "staff" } }, 201);
});

// Public: List active staff for login screen (minimal info only)
usersRoutes.get("/login-staff", async (c) => {
  const staffList = await db.query.users.findMany({
    where: and(eq(users.isActive, true), isNotNull(users.pin)),
    columns: {
      id: true,
      name: true,
      image: true,
    },
    orderBy: (users, { asc }) => [asc(users.name)],
  });

  return c.json({ staff: staffList });
});

// Public: PIN login — creates a full better-auth session
const pinAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

usersRoutes.post(
  "/login-pin",
  zValidator("json", pinLoginSchema),
  async (c) => {
    const { userId, pin } = c.req.valid("json");

    console.log(`Login attempt for userId: ${userId}`);
    console.log("Current pinAttempts state:", Array.from(pinAttempts.entries()));
    console.log("Pin::", pin);

    // Rate limiting per userId
    const attempt = pinAttempts.get(userId);
    if (attempt) {
      if (
        attempt.count >= MAX_PIN_ATTEMPTS &&
        Date.now() - attempt.lastAttempt < PIN_LOCKOUT_MS
      ) {
        return c.json(
          { error: "Trop de tentatives, réessayez dans 5 minutes" },
          429,
        );
      }
      if (Date.now() - attempt.lastAttempt >= PIN_LOCKOUT_MS) {
        pinAttempts.delete(userId);
      }
    }

    // Find user by ID and verify PIN
    // First, look up user by ID only to debug
    const userById = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true, pin: true, isActive: true, name: true },
    });
    console.log("[login-pin] User lookup by ID:", userById ? { id: userById.id, name: userById.name, hasPin: !!userById.pin, pinInDb: userById.pin, pinSent: pin, pinMatch: userById.pin === pin, isActive: userById.isActive } : "NOT FOUND");

    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.pin, pin),
        eq(users.isActive, true),
        isNotNull(users.pin),
      ),
    });

    if (!user) {
      console.log("[login-pin] FAILED - no user matched all conditions");
      // Track failed attempt
      const current = pinAttempts.get(userId) || {
        count: 0,
        lastAttempt: 0,
      };
      pinAttempts.set(userId, {
        count: current.count + 1,
        lastAttempt: Date.now(),
      });
      return c.json({ error: "PIN incorrect" }, 401);
    }

    console.log("[login-pin] SUCCESS - user matched:", user.id, user.name);

    // Reset attempts on success
    pinAttempts.delete(userId);

    // Create session (same structure better-auth uses)
    const sessionToken = crypto.randomBytes(32).toString("hex");
    const sessionId = nanoid();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      token: sessionToken,
      expiresAt,
      ipAddress: c.req.header("x-forwarded-for") || null,
      userAgent: c.req.header("user-agent") || null,
    });

    console.log("[login-pin] Session created:", { sessionId, tokenPrefix: sessionToken.slice(0, 8) + "...", expiresAt });

    // Verify session was actually saved
    const savedSession = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
    console.log("[login-pin] Session verified in DB:", savedSession ? { id: savedSession.id, tokenPrefix: savedSession.token.slice(0, 8) + "..." } : "NOT FOUND IN DB!");

    // Set session cookie (same name better-auth uses)
    const isSecure = process.env.NODE_ENV === "production";
    const cookieValue = `better-auth.session_token=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${isSecure ? "; Secure" : ""}`;
    c.header("Set-Cookie", cookieValue);
    console.log("[login-pin] Cookie set:", cookieValue.slice(0, 60) + "...");

    return c.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
      },
    });
  },
);

// Require authentication for all other routes
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.query.users.findMany({
        where: whereClause,
        limit,
        offset,
        columns: {
          id: true,
          name: true,
          email: true,
          pin: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: (users, { asc }) => [asc(users.name)],
      }),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(whereClause),
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

export default usersRoutes;
