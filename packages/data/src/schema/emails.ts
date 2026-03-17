import { relations } from "drizzle-orm";
import {
  index,
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

export const emailMessageTypeEnum = pgEnum("email_message_type", [
  "order_ready",
  "broadcast",
]);

// ── Tables ─────────────────────────────────────────────

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
    type: emailMessageTypeEnum("type").notNull(),
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

// ── Drizzle types ──────────────────────────────────────

export type EmailMessage = typeof emailMessages.$inferSelect;
export type NewEmailMessage = typeof emailMessages.$inferInsert;

// ── Zod schemas ────────────────────────────────────────

export const emailMessageStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);
export type EmailMessageStatusType = z.infer<typeof emailMessageStatusSchema>;

export const emailMessageTypeSchema = z.enum(["order_ready", "broadcast"]);
export type EmailMessageTypeType = z.infer<typeof emailMessageTypeSchema>;

export const sendEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
  type: emailMessageTypeSchema,
});
export type SendEmail = z.infer<typeof sendEmailSchema>;

export const sendBroadcastEmailSchema = z.object({
  subject: z.string().min(1).max(500),
  html: z.string().min(1),
});
export type SendBroadcastEmail = z.infer<typeof sendBroadcastEmailSchema>;

export const emailFiltersSchema = z.object({
  status: emailMessageStatusSchema.optional(),
  type: emailMessageTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type EmailFilters = z.infer<typeof emailFiltersSchema>;
