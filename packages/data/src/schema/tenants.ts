import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  preparationFilterDays: integer("preparation_filter_days").notNull().default(0),
  smsCredits: integer("sms_credits").notNull().default(0),
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
});
export type UpdateTenantSettings = z.infer<typeof updateTenantSettingsSchema>;

// Owner creation (admin creates owner for a tenant)
export const createOwnerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});
export type CreateOwner = z.infer<typeof createOwnerSchema>;

// Platform admin creation
export const createAdminSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});
export type CreateAdmin = z.infer<typeof createAdminSchema>;

// Update admin schema
export const updateAdminSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.name !== undefined || data.email !== undefined, {
    message: "Au moins un champ doit être fourni",
  });
export type UpdateAdmin = z.infer<typeof updateAdminSchema>;
