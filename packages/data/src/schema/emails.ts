import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { users } from "./auth.js";
import { tenants } from "./tenants.js";

// ── Enums ──────────────────────────────────────────────

export const emailMessageStatusEnum = pgEnum("email_message_status", [
  "pending",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);

// ── Tables ─────────────────────────────────────────────

/** Individual emails (order-ready notifications only) */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    recipientEmail: varchar("recipient_email", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    subject: varchar("subject", { length: 500 }).notNull(),
    status: emailMessageStatusEnum("status").notNull().default("pending"),
    resendId: varchar("resend_id", { length: 255 }),
    errorMessage: text("error_message"),
    sentById: text("sent_by_id").references(() => users.id),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("email_messages_tenant_idx").on(table.tenantId)],
);

/** Broadcast summary — one row per broadcast, no per-recipient rows */
export const emailBroadcasts = pgTable(
  "email_broadcasts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    subject: varchar("subject", { length: 500 }).notNull(),
    html: text("html").notNull(),
    totalRecipients: integer("total_recipients").notNull().default(0),
    sent: integer("sent").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    sentById: text("sent_by_id").references(() => users.id),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_broadcasts_tenant_idx").on(table.tenantId)],
);

// ── Relations ──────────────────────────────────────────

export const emailMessagesRelations = relations(emailMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [emailMessages.tenantId],
    references: [tenants.id],
  }),
  sentBy: one(users, {
    fields: [emailMessages.sentById],
    references: [users.id],
  }),
}));

export const emailBroadcastsRelations = relations(
  emailBroadcasts,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [emailBroadcasts.tenantId],
      references: [tenants.id],
    }),
    sentBy: one(users, {
      fields: [emailBroadcasts.sentById],
      references: [users.id],
    }),
  }),
);

// ── Drizzle types ──────────────────────────────────────

export type EmailMessage = typeof emailMessages.$inferSelect;
export type NewEmailMessage = typeof emailMessages.$inferInsert;
export type EmailBroadcast = typeof emailBroadcasts.$inferSelect;
export type NewEmailBroadcast = typeof emailBroadcasts.$inferInsert;

// ── Zod schemas ────────────────────────────────────────

export const emailMessageStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);
export type EmailMessageStatusType = z.infer<typeof emailMessageStatusSchema>;

export const sendEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
});
export type SendEmail = z.infer<typeof sendEmailSchema>;

export const sendBroadcastEmailSchema = z.object({
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
});
export type SendBroadcastEmail = z.infer<typeof sendBroadcastEmailSchema>;

export const emailFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type EmailFilters = z.infer<typeof emailFiltersSchema>;
