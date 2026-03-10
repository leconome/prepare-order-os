import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenants } from "./tenants.js";
import { orders } from "./orders.js";

export const posTypeEnum = pgEnum("pos_type", [
  "pickup_location",
  "permanent_pos",
]);

export const pointsOfSale = pgTable(
  "points_of_sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    type: posTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("points_of_sale_tenant_id_idx").on(table.tenantId),
    unique("points_of_sale_tenant_name_unique").on(table.tenantId, table.name),
  ],
);

export const pointsOfSaleRelations = relations(
  pointsOfSale,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [pointsOfSale.tenantId],
      references: [tenants.id],
    }),
    orders: many(orders),
  }),
);

// Drizzle types
export type PointOfSale = typeof pointsOfSale.$inferSelect;
export type NewPointOfSale = typeof pointsOfSale.$inferInsert;

// Zod schemas from drizzle-zod
export const insertPointOfSaleSchema = createInsertSchema(pointsOfSale);
export const selectPointOfSaleSchema = createSelectSchema(pointsOfSale);

// Custom schemas for API
export const posTypeSchema = z.enum(["pickup_location", "permanent_pos"]);

export const createPointOfSaleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  type: posTypeSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updatePointOfSaleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  type: posTypeSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const pointOfSaleFiltersSchema = z.object({
  type: posTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Types
export type CreatePointOfSale = z.infer<typeof createPointOfSaleSchema>;
export type UpdatePointOfSale = z.infer<typeof updatePointOfSaleSchema>;
export type PointOfSaleFilters = z.infer<typeof pointOfSaleFiltersSchema>;
export type PosType = z.infer<typeof posTypeSchema>;
