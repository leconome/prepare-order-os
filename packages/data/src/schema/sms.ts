import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { users } from "./auth.js";
import { tenants } from "./tenants.js";

// ── Enums ──────────────────────────────────────────────

export const smsCreditTransactionTypeEnum = pgEnum(
  "sms_credit_transaction_type",
  ["grant", "spend", "revoke"],
);

export const smsMessageStatusEnum = pgEnum("sms_message_status", [
  "pending",
  "sent",
  "delivered",
  "failed",
]);

// ── Tables ─────────────────────────────────────────────

export const smsCreditTransactions = pgTable(
  "sms_credit_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    type: smsCreditTransactionTypeEnum("type").notNull(),
    description: text("description"),
    createdById: text("created_by_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sms_credit_tx_tenant_idx").on(table.tenantId)],
);

export const smsMessages = pgTable(
  "sms_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    recipientPhone: varchar("recipient_phone", { length: 20 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    content: text("content").notNull(),
    status: smsMessageStatusEnum("status").notNull().default("pending"),
    ovhMessageId: varchar("ovh_message_id", { length: 255 }),
    creditsCost: integer("credits_cost").notNull().default(1),
    sentById: text("sent_by_id").references(() => users.id),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("sms_messages_tenant_idx").on(table.tenantId)],
);

// ── Relations ──────────────────────────────────────────

export const smsCreditTransactionsRelations = relations(
  smsCreditTransactions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [smsCreditTransactions.tenantId],
      references: [tenants.id],
    }),
    createdBy: one(users, {
      fields: [smsCreditTransactions.createdById],
      references: [users.id],
    }),
  }),
);

export const smsMessagesRelations = relations(smsMessages, ({ one }) => ({
  tenant: one(tenants, {
    fields: [smsMessages.tenantId],
    references: [tenants.id],
  }),
  sentBy: one(users, {
    fields: [smsMessages.sentById],
    references: [users.id],
  }),
}));

// ── Drizzle types ──────────────────────────────────────

export type SmsCreditTransaction = typeof smsCreditTransactions.$inferSelect;
export type NewSmsCreditTransaction = typeof smsCreditTransactions.$inferInsert;
export type SmsMessage = typeof smsMessages.$inferSelect;
export type NewSmsMessage = typeof smsMessages.$inferInsert;

// ── Zod schemas ────────────────────────────────────────

export const smsMessageStatusSchema = z.enum([
  "pending",
  "sent",
  "delivered",
  "failed",
]);
export type SmsMessageStatusType = z.infer<typeof smsMessageStatusSchema>;

export const smsCreditTransactionTypeSchema = z.enum([
  "grant",
  "spend",
  "revoke",
]);
export type SmsCreditTransactionTypeType = z.infer<
  typeof smsCreditTransactionTypeSchema
>;

export const grantCreditsSchema = z.object({
  amount: z.number().int().positive(),
  description: z.string().optional(),
});
export type GrantCredits = z.infer<typeof grantCreditsSchema>;

export const revokeCreditsSchema = z.object({
  amount: z.number().int().positive(),
  description: z.string().optional(),
});
export type RevokeCredits = z.infer<typeof revokeCreditsSchema>;

export const sendSmsSchema = z.object({
  recipientPhone: z
    .string()
    .min(1)
    .regex(/^\+?[0-9\s-]+$/, "Invalid phone number"),
  recipientName: z.string().optional(),
  content: z.string().min(1).max(480),
});
export type SendSms = z.infer<typeof sendSmsSchema>;

export const smsFiltersSchema = z.object({
  status: smsMessageStatusSchema.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type SmsFilters = z.infer<typeof smsFiltersSchema>;

export const smsCreditFiltersSchema = z.object({
  type: smsCreditTransactionTypeSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type SmsCreditFilters = z.infer<typeof smsCreditFiltersSchema>;
