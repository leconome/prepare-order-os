import {
  smsCreditTransactions,
  smsMessages,
  tenants,
  type SmsCreditFilters,
  type SmsFilters,
} from "@prepareos/data";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import * as ovh from "../lib/ovh.js";

// ── OVH platform credits ──────────────────────────────

export async function getOvhCredits() {
  return ovh.getAccountCredits();
}

export function getCreditBuyUrl() {
  return ovh.getCreditBuyUrl();
}

export function isOvhConfigured() {
  return ovh.isOvhConfigured();
}

// ── Tenant credit balance ──────────────────────────────

export async function getTenantCreditBalance(tenantId: string) {
  const result = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
    columns: { smsCredits: true },
  });
  return result?.smsCredits ?? 0;
}

// ── Grant credits ──────────────────────────────────────

export async function grantCredits(
  tenantId: string,
  amount: number,
  adminUserId: string,
  description?: string,
) {
  await db.insert(smsCreditTransactions).values({
    tenantId,
    amount,
    type: "grant",
    description: description || `Granted ${amount} SMS credit(s)`,
    createdById: adminUserId,
  });

  await db
    .update(tenants)
    .set({
      smsCredits: sql`${tenants.smsCredits} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  return getTenantCreditBalance(tenantId);
}

// ── Revoke credits ─────────────────────────────────────

export async function revokeCredits(
  tenantId: string,
  amount: number,
  adminUserId: string,
  description?: string,
) {
  const balance = await getTenantCreditBalance(tenantId);
  const toRevoke = Math.min(amount, balance);
  if (toRevoke <= 0) return balance;

  await db.insert(smsCreditTransactions).values({
    tenantId,
    amount: -toRevoke,
    type: "revoke",
    description: description || `Revoked ${toRevoke} SMS credit(s)`,
    createdById: adminUserId,
  });

  await db
    .update(tenants)
    .set({
      smsCredits: sql`GREATEST(${tenants.smsCredits} - ${toRevoke}, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  return getTenantCreditBalance(tenantId);
}

// ── Send SMS ───────────────────────────────────────────

export async function sendSmsMessage(
  tenantId: string,
  recipientPhone: string,
  content: string,
  sentById: string,
  recipientName?: string,
) {
  const balance = await getTenantCreditBalance(tenantId);
  if (balance < 1) {
    throw new Error("Insufficient SMS credits");
  }

  // Insert message row as pending
  const [message] = await db
    .insert(smsMessages)
    .values({
      tenantId,
      recipientPhone,
      recipientName: recipientName ?? null,
      content,
      status: "pending",
      sentById,
    })
    .returning();

  // Deduct credit upfront — refund if OVH rejects
  await db.insert(smsCreditTransactions).values({
    tenantId,
    amount: -1,
    type: "spend",
    description: `SMS to ${recipientPhone}`,
    createdById: sentById,
  });

  await db
    .update(tenants)
    .set({
      smsCredits: sql`GREATEST(${tenants.smsCredits} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId));

  try {
    const result = await ovh.sendSms(recipientPhone, content);
    const ovhMessageId = result.ids?.[0]?.toString() ?? null;

    await db
      .update(smsMessages)
      .set({
        status: "sent",
        ovhMessageId,
        updatedAt: new Date(),
      })
      .where(eq(smsMessages.id, message.id));

    return { ...message, status: "sent" as const, ovhMessageId };
  } catch (error) {
    // OVH rejected — refund the credit
    await db.insert(smsCreditTransactions).values({
      tenantId,
      amount: 1,
      type: "grant",
      description: `Refund - SMS to ${recipientPhone} failed`,
      createdById: sentById,
    });

    await db
      .update(tenants)
      .set({
        smsCredits: sql`${tenants.smsCredits} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    await db
      .update(smsMessages)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(smsMessages.id, message.id));

    throw error;
  }
}

// ── List messages ──────────────────────────────────────

export async function listMessages(tenantId: string, filters: SmsFilters) {
  const { status, fromDate, toDate, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(smsMessages.tenantId, tenantId)];
  if (status) conditions.push(eq(smsMessages.status, status));
  if (fromDate) conditions.push(gte(smsMessages.sentAt, fromDate));
  if (toDate) conditions.push(lte(smsMessages.sentAt, toDate));

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(smsMessages)
      .where(whereClause)
      .orderBy(desc(smsMessages.sentAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(smsMessages)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── List credit transactions ───────────────────────────

export async function listCreditTransactions(
  tenantId: string,
  filters: SmsCreditFilters,
) {
  const { type, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(smsCreditTransactions.tenantId, tenantId)];
  if (type) conditions.push(eq(smsCreditTransactions.type, type));

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(smsCreditTransactions)
      .where(whereClause)
      .orderBy(desc(smsCreditTransactions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(smsCreditTransactions)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ── Refresh message status ─────────────────────────────

export async function refreshMessageStatus(messageId: string) {
  const message = await db.query.smsMessages.findFirst({
    where: eq(smsMessages.id, messageId),
  });

  if (!message?.ovhMessageId) return message;

  try {
    const result = await ovh.getSmsStatus(Number(message.ovhMessageId));
    let newStatus: "sent" | "delivered" | "failed" = "sent";
    // OVH delivery receipt values: 0 = not received, 1 = received, 2 = pending, 3 = error
    const receipt = Number(result.status);
    if (receipt === 1) newStatus = "delivered";
    else if (receipt === 3) newStatus = "failed";

    if (newStatus !== message.status) {
      await db
        .update(smsMessages)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(smsMessages.id, messageId));
    }

    return { ...message, status: newStatus };
  } catch {
    return message;
  }
}

// ── All tenants with SMS credits (admin) ───────────────

export async function listTenantsWithCredits() {
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      smsCredits: tenants.smsCredits,
    })
    .from(tenants)
    .orderBy(tenants.name);
}

// ── Total credits distributed across all tenants ───────

export async function getTotalDistributedCredits(): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${tenants.smsCredits}), 0)` })
    .from(tenants);
  return Number(result[0]?.total ?? 0);
}
