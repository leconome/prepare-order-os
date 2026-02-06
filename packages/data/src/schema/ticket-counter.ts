import { pgTable, varchar, integer, primaryKey, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenants } from "./tenants.js";

export const ticketCounters = pgTable(
  "ticket_counters",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    dateKey: varchar("date_key", { length: 6 }).notNull(),
    counter: integer("counter").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.dateKey] })],
);

// Drizzle types
export type TicketCounter = typeof ticketCounters.$inferSelect;
export type NewTicketCounter = typeof ticketCounters.$inferInsert;

// Zod schemas
export const insertTicketCounterSchema = createInsertSchema(ticketCounters);
export const selectTicketCounterSchema = createSelectSchema(ticketCounters);
