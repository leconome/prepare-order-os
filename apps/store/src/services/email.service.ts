import {
  clients,
  type EmailFilters,
  type EmailMessageTypeType,
  emailMessages,
} from "@prepareos/data";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import resend from "../lib/resend.js";

const FROM = "PrepareOS <admin@email.econome.studio>";

export async function sendEmailMessage(
  tenantId: string,
  recipientEmail: string,
  subject: string,
  html: string,
  type: EmailMessageTypeType,
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
      type,
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

  // Insert all message rows as pending
  const messageRows = await db
    .insert(emailMessages)
    .values(
      validClients.map((c) => ({
        tenantId,
        recipientEmail: c.email,
        recipientName: c.name,
        subject,
        type: "broadcast" as const,
        status: "pending" as const,
        sentById,
      })),
    )
    .returning();

  // Resend batch API supports up to 100 emails per call
  // Fire all chunks concurrently with Promise.allSettled
  const BATCH_SIZE = 100;
  const chunks: {
    clients: typeof validClients;
    messages: typeof messageRows;
  }[] = [];

  for (let i = 0; i < validClients.length; i += BATCH_SIZE) {
    chunks.push({
      clients: validClients.slice(i, i + BATCH_SIZE),
      messages: messageRows.slice(i, i + BATCH_SIZE),
    });
  }

  const results = await Promise.allSettled(
    chunks.map(async ({ clients: batch, messages: batchMessages }) => {
      const result = await resend.batch.send(
        batch.map((c) => ({
          from: FROM,
          to: c.email,
          subject,
          html,
        })),
      );

      // Update message rows with Resend IDs
      const resendIds = result.data?.data ?? [];
      await Promise.all(
        batchMessages.map((msg, idx) =>
          db
            .update(emailMessages)
            .set({
              status: "sent",
              resendId: resendIds[idx]?.id ?? null,
              updatedAt: new Date(),
            })
            .where(eq(emailMessages.id, msg.id)),
        ),
      );

      return batch.length;
    }),
  );

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      sent += result.value;
    } else {
      const batchMessages = chunks[i].messages;
      failed += batchMessages.length;
      await Promise.all(
        batchMessages.map((msg) =>
          db
            .update(emailMessages)
            .set({
              status: "failed",
              errorMessage: String(result.reason),
              updatedAt: new Date(),
            })
            .where(eq(emailMessages.id, msg.id)),
        ),
      );
    }
  }

  return { total: validClients.length, sent, failed };
}

export async function listEmailMessages(
  tenantId: string,
  filters: EmailFilters,
) {
  const { status, type, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(emailMessages.tenantId, tenantId)];
  if (status) conditions.push(eq(emailMessages.status, status));
  if (type) conditions.push(eq(emailMessages.type, type));

  const whereClause = and(...conditions);

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
