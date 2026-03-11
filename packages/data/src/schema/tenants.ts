import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  preparationFilterDays: integer("preparation_filter_days").notNull().default(0),
  smsCredits: integer("sms_credits").notNull().default(0),
  // API key for external services (e.g. WordPress plugin)
  apiKey: varchar("api_key", { length: 500 }),
  apiKeyLastUsedAt: timestamp("api_key_last_used_at", { withTimezone: true }),
  // WordPress/WooCommerce site URL
  wooUrl: varchar("woo_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Drizzle types
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

// Zod schemas
export const insertTenantSchema = createInsertSchema(tenants);
export const selectTenantSchema = createSelectSchema(tenants);

export const createTenantSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});
export type CreateTenant = z.infer<typeof createTenantSchema>;

export const updateTenantSettingsSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  preparationFilterDays: z.number().int().min(0).max(30).optional(),
  wooUrl: z.string().url().max(500).optional().nullable(),
});
export type UpdateTenantSettings = z.infer<typeof updateTenantSettingsSchema>;
