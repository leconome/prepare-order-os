import { pgTable, varchar, integer, primaryKey } from "drizzle-orm/pg-core";

export const ticketCounters = pgTable("ticket_counters", {
  dateKey: varchar("date_key", { length: 6 }).notNull(),
  counter: integer("counter").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.dateKey] }),
]);

export type TicketCounter = typeof ticketCounters.$inferSelect;
export type NewTicketCounter = typeof ticketCounters.$inferInsert;
