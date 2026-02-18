import { eq, and, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { ticketCounters } from "@prepareos/data";

function getDateKey(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

export async function generateTicketNumber(tenantId: string): Promise<string> {
  const dateKey = getDateKey();

  const result = await db
    .insert(ticketCounters)
    .values({ tenantId, dateKey, counter: 1 })
    .onConflictDoUpdate({
      target: [ticketCounters.tenantId, ticketCounters.dateKey],
      set: { counter: sql`${ticketCounters.counter} + 1` },
    })
    .returning({ counter: ticketCounters.counter });

  const counter = result[0]?.counter ?? 1;
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
