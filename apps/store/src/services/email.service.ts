import {
  clients,
  type EmailFilters,
  emailBroadcasts,
  emailMessages,
} from "@prepareos/data";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import resend from "../lib/resend.js";

const FROM = "PrepareOS <admin@email.econome.studio>";

// ── Single email (order-ready) ────────────────────────

export async function sendEmailMessage(
  tenantId: string,
  recipientEmail: string,
  subject: string,
  html: string,
  sentById: string,
  recipientName?: string,
) {
  const [message] = await db
    .insert(emailMessages)
    .values({
      tenantId,
      recipientEmail,
      recipientName: recipientName ?? null,
      subject,
      status: "pending",
      sentById,
    })
    .returning();

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: recipientEmail,
      subject,
      html,
    });

    await db
      .update(emailMessages)
      .set({
        status: "sent",
        resendId: result.data?.id ?? null,
        updatedAt: new Date(),
      })
      .where(eq(emailMessages.id, message.id));

    return { ...message, status: "sent" as const, resendId: result.data?.id };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(emailMessages)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(emailMessages.id, message.id));
    throw error;
  }
}

// ── Broadcast (one summary row, no per-recipient rows) ─

export async function sendBroadcastEmail(
  tenantId: string,
  subject: string,
  html: string,
  sentById: string,
) {
  const clientsWithEmail = await db
    .select({ id: clients.id, name: clients.name, email: clients.email })
    .from(clients)
    .where(and(eq(clients.tenantId, tenantId), isNotNull(clients.email)));

  const validClients = clientsWithEmail.filter(
    (c): c is typeof c & { email: string } => !!c.email,
  );

  if (validClients.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  // Fire batches concurrently via Resend batch API (max 100 per call)
  const BATCH_SIZE = 100;
  const chunks: (typeof validClients)[] = [];
  for (let i = 0; i < validClients.length; i += BATCH_SIZE) {
    chunks.push(validClients.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.allSettled(
    chunks.map(async (batch) => {
      await resend.batch.send(
        batch.map((c) => ({
          from: FROM,
          to: c.email,
          subject,
          html,
        })),
      );
      return batch.length;
    }),
  );

  let sent = 0;
  let failed = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      sent += result.value;
    } else {
      failed += chunks[results.indexOf(result)].length;
    }
  }

  // Store one summary row
  await db.insert(emailBroadcasts).values({
    tenantId,
    subject,
    html,
    totalRecipients: validClients.length,
    sent,
    failed,
    sentById,
  });

  return { total: validClients.length, sent, failed };
}

// ── List individual emails (order-ready only) ─────────

export async function listEmailMessages(
  tenantId: string,
  filters: EmailFilters,
) {
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const whereClause = eq(emailMessages.tenantId, tenantId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(emailMessages)
      .where(whereClause)
      .orderBy(desc(emailMessages.sentAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(emailMessages)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ── List broadcasts ───────────────────────────────────

export async function listBroadcasts(tenantId: string, filters: EmailFilters) {
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const whereClause = eq(emailBroadcasts.tenantId, tenantId);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(emailBroadcasts)
      .where(whereClause)
      .orderBy(desc(emailBroadcasts.sentAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(emailBroadcasts)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
