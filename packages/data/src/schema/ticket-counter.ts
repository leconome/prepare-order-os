import { pgTable, varchar, integer, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const ticketCounters = pgTable(
  "ticket_counters",
  {
    dateKey: varchar("date_key", { length: 6 }).notNull(),
    counter: integer("counter").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.dateKey] })],
);

// Drizzle types
export type TicketCounter = typeof ticketCounters.$inferSelect;
export type NewTicketCounter = typeof ticketCounters.$inferInsert;

// Zod schemas
export const insertTicketCounterSchema = createInsertSchema(ticketCounters);
export const selectTicketCounterSchema = createSelectSchema(ticketCounters);
