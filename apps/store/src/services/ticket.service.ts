import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { ticketCounters } from "@prepareos/data";
import { orders } from "@prepareos/data/schema";

function getDateKey(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function generateTicketNumber(tenantId: string): Promise<string> {
  const dateKey = getDateKey();
  const prefix = `${dateKey}:`;

  // Get the max existing ticket number for today from actual orders
  const maxResult = await db
    .select({
      maxNum: sql<number>`COALESCE(MAX(CAST(SPLIT_PART(ticket_number, ':', 2) AS INTEGER)), 0)`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, tenantId),
        sql`ticket_number LIKE ${prefix + "%"}`,
      ),
    );
  const maxExisting = maxResult[0]?.maxNum ?? 0;

  // Upsert the counter, ensuring it's always at least maxExisting + 1
  const result = await db
    .insert(ticketCounters)
    .values({ tenantId, dateKey, counter: maxExisting + 1 })
    .onConflictDoUpdate({
      target: [ticketCounters.tenantId, ticketCounters.dateKey],
      set: {
        counter: sql`GREATEST(${ticketCounters.counter} + 1, ${maxExisting + 1})`,
      },
    })
    .returning({ counter: ticketCounters.counter });

  const counter = result[0]?.counter ?? maxExisting + 1;
  const paddedCounter = counter.toString().padStart(3, "0");

  return `${dateKey}:${paddedCounter}`;
}

export async function getCurrentCounter(tenantId: string, dateKey?: string): Promise<number> {
  const key = dateKey ?? getDateKey();

  const result = await db.query.ticketCounters.findFirst({
    where: and(eq(ticketCounters.dateKey, key), eq(ticketCounters.tenantId, tenantId)),
  });

  return result?.counter ?? 0;
}
