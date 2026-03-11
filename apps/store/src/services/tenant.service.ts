import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tenants, type Tenant, type UpdateTenantSettings } from "@prepareos/data";

// ── Queries ──

export async function getTenant(tenantId: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
}

export async function getTenantPublic(tenantId: string) {
  return db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
}

export async function updateTenantSettings(
  tenantId: string,
  data: UpdateTenantSettings,
) {
  const updateData: Partial<typeof tenants.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.preparationFilterDays !== undefined)
    updateData.preparationFilterDays = data.preparationFilterDays;

  const [updated] = await db
    .update(tenants)
    .set(updateData)
    .where(eq(tenants.id, tenantId))
    .returning();

  return updated;
}

// ── API Key ──

export async function generateApiKey(
  tenantId: string,
): Promise<{ apiKey: string }> {
  const plain = "sk_" + crypto.randomBytes(32).toString("hex");

  await db
    .update(tenants)
    .set({ apiKey: plain, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));

  return { apiKey: plain };
}

export async function verifyApiKey(plain: string): Promise<Tenant | null> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.apiKey, plain),
  });
  return tenant ?? null;
}

export async function touchApiKeyLastUsed(tenantId: string) {
  await db
    .update(tenants)
    .set({ apiKeyLastUsedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}
