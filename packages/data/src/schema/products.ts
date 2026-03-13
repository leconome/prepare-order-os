import {
  pgTable,
  uuid,
  varchar,
  text,
  decimal,
  boolean,
  integer,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { UNITS } from "../units.js";
import { categories } from "./categories.js";
import { tenants } from "./tenants.js";

export const unitTypeEnum = pgEnum("unit_type", UNITS);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id),
    imageUrl: text("image_url"),
    stock: decimal("stock", { precision: 10, scale: 3 }),
    unitType: unitTypeEnum("unit_type").notNull().default("piece"),
    defaultQty: decimal("default_qty", { precision: 10, scale: 3 }),
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
  (table) => [index("products_tenant_id_idx").on(table.tenantId)],
);

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

// Drizzle types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

// Zod schemas from drizzle-zod
export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);

// Unit type schema (derived from shared UNITS constant)
export const unitTypeSchema = z.enum(UNITS);

// Custom schemas for API
export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  categoryId: z.string().uuid().optional(),
  imageUrl: z.string().url().nullish().or(z.literal("")),
  stock: z.number().min(0).nullable().optional(),
  unitType: unitTypeSchema.default("piece"),
  defaultQty: z.number().positive().nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid price format")
    .optional(),
  categoryId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().nullish().or(z.literal("")),
  stock: z.number().min(0).nullable().optional(),
  unitType: unitTypeSchema.optional(),
  defaultQty: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const productFiltersSchema = z.object({
  categoryId: z.string().uuid().optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  maxStock: z.coerce.number().int().min(0).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Types
export type UnitType = z.infer<typeof unitTypeSchema>;
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
