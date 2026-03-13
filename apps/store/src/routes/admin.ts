import { zValidator } from "@hono/zod-validator";
import {
  createAdminSchema,
  createOwnerSchema,
  createTenantSchema,
  grantCreditsSchema,
  revokeCreditsSchema,
  smsCreditFiltersSchema,
  tenants,
  updateAdminSchema,
} from "@prepareos/data";
import { users } from "@prepareos/data/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { adminOnly } from "../middleware/role-guard.js";
import * as smsService from "../services/sms.service.js";
import type { AppEnv } from "../types.js";

const admin = new Hono<AppEnv>();

admin.use("*", authMiddleware);
admin.use("*", adminOnly);

const RESERVED_SUBDOMAINS = ["api", "admin", "www", "app", "mail"];

// POST /api/admin/tenants — create a new tenant
admin.post("/tenants", zValidator("json", createTenantSchema), async (c) => {
  const { name, slug } = c.req.valid("json");

  if (RESERVED_SUBDOMAINS.includes(slug)) {
    return c.json(
      { error: "Ce slug est réservé et ne peut pas être utilisé" },
      400,
    );
  }

  const existing = await db.query.tenants.findFirst({
    where: eq(tenants.slug, slug),
  });
  if (existing) {
    return c.json(
      { error: "Ce slug est déjà utilisé par un autre tenant" },
      409,
    );
  }

  const [tenant] = await db.insert(tenants).values({ name, slug }).returning();

  return c.json({ data: tenant }, 201);
});

// GET /api/admin/tenants — list all tenants (admin only)
admin.get("/tenants", async (c) => {
  const allTenants = await db.select().from(tenants).orderBy(tenants.createdAt);

  return c.json({ data: allTenants });
});

// GET /api/admin/tenants/:tenantId — get single tenant with owner count
admin.get("/tenants/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return c.json({ error: "Tenant non trouvé" }, 404);
  }

  const [ownerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "owner")));

  return c.json({
    data: {
      ...tenant,
      ownerCount: Number(ownerCount?.count ?? 0),
    },
  });
});

// ── Owner Management ────────────────────────────────

// GET /api/admin/tenants/:tenantId/owners — list owners for a tenant
admin.get("/tenants/:tenantId/owners", async (c) => {
  const tenantId = c.req.param("tenantId");

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  if (!tenant) {
    return c.json({ error: "Tenant non trouvé" }, 404);
  }

  const owners = await db.query.users.findMany({
    where: and(eq(users.tenantId, tenantId), eq(users.role, "owner")),
    columns: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({ data: owners });
});

// POST /api/admin/tenants/:tenantId/owners — create owner
admin.post(
  "/tenants/:tenantId/owners",
  zValidator("json", createOwnerSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const { name, email, password } = c.req.valid("json");

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    if (!tenant) {
      return c.json({ error: "Tenant non trouvé" }, 404);
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return c.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        409,
      );
    }

    try {
      const result = await auth.api.signUpEmail({
        body: { email, password, name, tenantId },
      });

      if (!result.user) {
        return c.json({ error: "Échec de la création du propriétaire" }, 500);
      }

      await db
        .update(users)
        .set({ role: "owner", tenantId })
        .where(eq(users.id, result.user.id));

      const owner = await db.query.users.findFirst({
        where: eq(users.id, result.user.id),
        columns: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });

      return c.json({ data: owner }, 201);
    } catch (error) {
      console.error("Failed to create owner:", error);
      return c.json({ error: "Échec de la création du propriétaire" }, 500);
    }
  },
);

// PATCH /api/admin/tenants/:tenantId/owners/:userId — toggle owner active status
admin.patch("/tenants/:tenantId/owners/:userId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const userId = c.req.param("userId");

  const owner = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.tenantId, tenantId),
      eq(users.role, "owner"),
    ),
  });

  if (!owner) {
    return c.json({ error: "Propriétaire non trouvé" }, 404);
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: !owner.isActive, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return c.json({ data: updated });
});

// ── Platform Admin Management ────────────────────────────────

// GET /api/admin/users — list platform admins
admin.get("/users", async (c) => {
  const admins = await db.query.users.findMany({
    where: and(eq(users.role, "admin"), isNull(users.tenantId)),
    columns: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({ data: admins });
});

// POST /api/admin/users — create platform admin
admin.post("/users", zValidator("json", createAdminSchema), async (c) => {
  const { name, email, password } = c.req.valid("json");

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return c.json({ error: "Un utilisateur avec cet email existe déjà" }, 409);
  }

  try {
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    if (!result.user) {
      return c.json({ error: "Échec de la création de l'administrateur" }, 500);
    }

    await db
      .update(users)
      .set({ role: "admin", tenantId: null })
      .where(eq(users.id, result.user.id));

    const admin = await db.query.users.findFirst({
      where: eq(users.id, result.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
      },
    });

    return c.json({ data: admin }, 201);
  } catch (error) {
    console.error("Failed to create admin:", error);
    return c.json({ error: "Échec de la création de l'administrateur" }, 500);
  }
});

// PATCH /api/admin/users/:userId — update admin
admin.patch(
  "/users/:userId",
  zValidator("json", updateAdminSchema),
  async (c) => {
    const userId = c.req.param("userId");
    const data = c.req.valid("json");

    const existing = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.role, "admin"),
        isNull(users.tenantId),
      ),
    });

    if (!existing) {
      return c.json({ error: "Administrateur non trouvé" }, 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) {
      const emailTaken = await db.query.users.findFirst({
        where: and(eq(users.email, data.email)),
      });
      if (emailTaken && emailTaken.id !== userId) {
        return c.json({ error: "Cet email est déjà utilisé" }, 409);
      }
      updateData.email = data.email;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return c.json({ data: updated });
  },
);

// DELETE /api/admin/users/:userId — deactivate admin (soft delete)
admin.delete("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const currentUser = c.get("user");

  if (currentUser.id === userId) {
    return c.json(
      { error: "Vous ne pouvez pas désactiver votre propre compte" },
      400,
    );
  }

  const existing = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.role, "admin"),
      isNull(users.tenantId),
    ),
  });

  if (!existing) {
    return c.json({ error: "Administrateur non trouvé" }, 404);
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return c.json({ data: updated });
});

// ── SMS Admin Endpoints ────────────────────────────────

// GET /api/admin/sms/credits — OVH platform credit balance
admin.get("/sms/credits", async (c) => {
  if (!smsService.isOvhConfigured()) {
    return c.json({ error: "OVH SMS not configured" }, 503);
  }
  try {
    const credits = await smsService.getOvhCredits();
    const buyUrl = smsService.getCreditBuyUrl();
    return c.json({ ...credits, buyUrl });
  } catch (error) {
    console.error("Failed to fetch OVH credits:", error);
    const msg = error instanceof Error ? error.message : "OVH API error";
    return c.json({ error: msg }, 500);
  }
});

// GET /api/admin/sms/tenants — all tenants with SMS credit balances + available to distribute
admin.get("/sms/tenants", async (c) => {
  const [data, totalDistributed] = await Promise.all([
    smsService.listTenantsWithCredits(),
    smsService.getTotalDistributedCredits(),
  ]);

  // Try to get OVH credits for the available calculation
  let ovhCreditsLeft: number | null = null;
  if (smsService.isOvhConfigured()) {
    try {
      const ovhData = await smsService.getOvhCredits();
      ovhCreditsLeft = ovhData.creditsLeft;
    } catch {
      // OVH unreachable, skip
    }
  }

  const available =
    ovhCreditsLeft !== null
      ? Math.max(0, ovhCreditsLeft - totalDistributed)
      : null;

  return c.json({ data, totalDistributed, available });
});

// POST /api/admin/sms/tenants/:tenantId/grant — grant credits
admin.post(
  "/sms/tenants/:tenantId/grant",
  zValidator("json", grantCreditsSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const user = c.get("user");
    const { amount, description } = c.req.valid("json");

    // Check OVH cap: total distributed + new grant must not exceed OVH credits
    if (smsService.isOvhConfigured()) {
      try {
        const [ovhData, totalDistributed] = await Promise.all([
          smsService.getOvhCredits(),
          smsService.getTotalDistributedCredits(),
        ]);
        const available = Math.max(0, ovhData.creditsLeft - totalDistributed);
        if (amount > available) {
          return c.json(
            {
              error: `Credits insuffisants. Disponible : ${available} (OVH : ${ovhData.creditsLeft}, distribues : ${totalDistributed})`,
              available,
            },
            400,
          );
        }
      } catch {
        // If OVH API fails, allow grant anyway (offline mode)
      }
    }

    const newBalance = await smsService.grantCredits(
      tenantId,
      amount,
      user.id,
      description,
    );
    return c.json({ credits: newBalance });
  },
);

// POST /api/admin/sms/tenants/:tenantId/revoke — revoke credits
admin.post(
  "/sms/tenants/:tenantId/revoke",
  zValidator("json", revokeCreditsSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const user = c.get("user");
    const { amount, description } = c.req.valid("json");
    const newBalance = await smsService.revokeCredits(
      tenantId,
      amount,
      user.id,
      description,
    );
    return c.json({ credits: newBalance });
  },
);

// GET /api/admin/sms/tenants/:tenantId/transactions — credit ledger
admin.get(
  "/sms/tenants/:tenantId/transactions",
  zValidator("query", smsCreditFiltersSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const filters = c.req.valid("query");
    const result = await smsService.listCreditTransactions(tenantId, filters);
    return c.json(result);
  },
);

export default admin;
