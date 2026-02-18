import { zValidator } from "@hono/zod-validator";
import {
  grantCreditsSchema,
  revokeCreditsSchema,
  smsCreditFiltersSchema,
  tenants,
} from "@prepareos/data";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";
import { adminOnly } from "../middleware/role-guard.js";
import * as smsService from "../services/sms.service.js";
import type { AppEnv } from "../types.js";

const admin = new Hono<AppEnv>();

admin.use("*", authMiddleware);
admin.use("*", adminOnly);

// GET /api/admin/tenants — list all tenants (admin only)
admin.get("/tenants", async (c) => {
  const allTenants = await db.select().from(tenants).orderBy(tenants.createdAt);

  return c.json({ data: allTenants });
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
