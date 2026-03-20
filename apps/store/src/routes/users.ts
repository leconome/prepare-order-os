import { zValidator } from "@hono/zod-validator";
import {
  createStaffSchema,
  pinLoginSchema,
  staffFiltersSchema,
  updateStaffSchema,
} from "@prepareos/data";
import { users } from "@prepareos/data/schema";
import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const usersRoutes = new Hono<AppEnv>();

// Check if a user exists by email (for dev mode only - no auth required)
usersRoutes.get("/check/:email", async (c) => {
  // Only allow in dev stage
  const stage = process.env.STAGE;

  if (stage !== "dev") {
    return c.json({ error: "Not available in production" }, 403);
  }

  const tenantId = c.get("tenantId") as string;
  const email = c.req.param("email");

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, email), eq(users.tenantId, tenantId)),
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

  const tenantId = c.get("tenantId") as string;
  const { email, password, name, role } = await c.req.json();

  const result = await auth.api.signUpEmail({
    body: { email, password, name, tenantId },
  });

  if (!result.user) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  // Update role and ensure tenantId is set
  const updateFields: Record<string, unknown> = { tenantId };
  if (role && role !== "staff") {
    updateFields.role = role;
  }
  await db.update(users).set(updateFields).where(eq(users.id, result.user.id));

  return c.json({ user: { ...result.user, role: role || "staff" } }, 201);
});

// Public: List active staff for login screen (minimal info only)
usersRoutes.get("/login-staff", async (c) => {
  const tenantId = c.get("tenantId") as string;

  const staffList = await db.query.users.findMany({
    where: and(
      eq(users.isActive, true),
      isNotNull(users.pin),
      eq(users.tenantId, tenantId),
      ne(users.role, "admin"),
    ),
    columns: {
      id: true,
      name: true,
      image: true,
      role: true,
    },
    orderBy: (users, { asc }) => [asc(users.name)],
  });

  return c.json({ staff: staffList });
});

// Public: PIN login — creates a full better-auth session
const pinAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

usersRoutes.post(
  "/login-pin",
  zValidator("json", pinLoginSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const { userId, pin } = c.req.valid("json");

    console.log(`Login attempt for userId: ${userId}`);

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

    // Find user by ID and verify PIN — scoped by tenant
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.pin, pin),
        eq(users.isActive, true),
        eq(users.tenantId, tenantId),
        isNotNull(users.pin),
      ),
    });

    if (!user) {
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

    // Reset attempts on success
    pinAttempts.delete(userId);

    // Create session using better-auth's internal adapter
    const authCtx = await auth.$context;
    const session = await authCtx.internalAdapter.createSession(
      user.id,
      false, // dontRememberMe
      {
        ipAddress: c.req.header("x-forwarded-for") || "",
        userAgent: c.req.header("user-agent") || "",
      },
    );

    // Set session cookie (raw token — Better Auth doesn't use Hono's HMAC signing)
    const cookieName = authCtx.authCookies.sessionToken.name;
    const cookieAttrs = authCtx.authCookies.sessionToken.attributes;
    setCookie(c, cookieName, session.token, {
      ...cookieAttrs,
      maxAge: authCtx.sessionConfig.expiresIn,
    });

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
  const tenantId = c.get("tenantId") as string;

  const allUsers = await db.query.users.findMany({
    where: eq(users.tenantId, tenantId),
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
    const tenantId = c.get("tenantId") as string;
    const { role, isActive, page = 1, limit = 20 } = c.req.valid("query");
    const offset = (page - 1) * limit;

    const conditions = [eq(users.tenantId, tenantId), ne(users.role, "admin")];

    if (role) {
      conditions.push(eq(users.role, role));
    }

    if (isActive !== undefined) {
      conditions.push(eq(users.isActive, isActive));
    }

    const whereClause = and(...conditions);

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
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const user = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
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
    const tenantId = c.get("tenantId") as string;
    const { email, password, name, role } = c.req.valid("json");

    // Check if user already exists in this tenant
    const existing = await db.query.users.findFirst({
      where: and(eq(users.email, email), eq(users.tenantId, tenantId)),
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
          tenantId,
        },
      });

      if (!result.user) {
        return c.json({ error: "Failed to create user" }, 500);
      }

      // Update role and ensure tenantId is set
      const updateFields: Record<string, unknown> = { tenantId };
      if (role && role !== "staff") {
        updateFields.role = role;
      }
      await db
        .update(users)
        .set(updateFields)
        .where(eq(users.id, result.user.id));

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
    const tenantId = c.get("tenantId") as string;
    const { name, email, pin, role, isActive } = c.req.valid("json");

    // Check if user already exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (existing) {
      return c.json({ error: "User with this email already exists" }, 409);
    }

    // Check if PIN is already in use within this tenant
    const existingPin = await db.query.users.findFirst({
      where: and(eq(users.pin, pin), eq(users.tenantId, tenantId)),
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
        tenantId,
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
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db.query.users.findFirst({
      where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
    });

    if (!existing) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if new PIN is already in use by another user in this tenant
    if (data.pin) {
      const existingPin = await db.query.users.findFirst({
        where: and(eq(users.pin, data.pin), eq(users.tenantId, tenantId)),
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
      .where(and(eq(users.id, id), eq(users.tenantId, tenantId)))
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
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.tenantId, tenantId)),
  });

  if (!existing) {
    return c.json({ error: "User not found" }, 404);
  }

  await db
    .delete(users)
    .where(and(eq(users.id, id), eq(users.tenantId, tenantId)));

  return c.json({ success: true });
});

export default usersRoutes;
