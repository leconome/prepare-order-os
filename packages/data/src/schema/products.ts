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
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { UNITS } from "../units.js";
import { productAttributes, attributeTerms } from "./attributes.js";
import { categories } from "./categories.js";
import { tenants } from "./tenants.js";

export const unitTypeEnum = pgEnum("unit_type", UNITS);

export const stockModeEnum = pgEnum("stock_mode", ["individual", "shared"]);

export const stockModeSchema = z.enum(["individual", "shared"]);

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
    stockMode: stockModeEnum("stock_mode"),
    attributeId: uuid("attribute_id").references(() => productAttributes.id, {
      onDelete: "set null",
    }),
    wooId: integer("woo_id"),
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
    index("products_tenant_id_idx").on(table.tenantId),
    uniqueIndex("products_tenant_woo_id_idx").on(table.tenantId, table.wooId),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    attributeTermId: uuid("attribute_term_id").references(
      () => attributeTerms.id,
      { onDelete: "set null" },
    ),
    name: varchar("name", { length: 100 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    stock: decimal("stock", { precision: 10, scale: 3 }),
    capacity: decimal("capacity", { precision: 10, scale: 3 })
      .notNull()
      .default("1"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("product_variants_product_id_idx").on(table.productId)],
);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  attribute: one(productAttributes, {
    fields: [products.attributeId],
    references: [productAttributes.id],
  }),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    attributeTerm: one(attributeTerms, {
      fields: [productVariants.attributeTermId],
      references: [attributeTerms.id],
    }),
  }),
);

// Drizzle types
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

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
  stockMode: stockModeSchema.nullable().optional(),
  attributeId: z.string().uuid().nullable().optional(),
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
  stockMode: stockModeSchema.nullable().optional(),
  attributeId: z.string().uuid().nullable().optional(),
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

// Variant schemas
export const createVariantSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
  stock: z.number().min(0).nullable().optional(),
  capacity: z.number().positive().optional(),
  attributeTermId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateVariantSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  price: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid price format")
    .optional(),
  stock: z.number().min(0).nullable().optional(),
  capacity: z.number().positive().optional(),
  attributeTermId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// Types
export type UnitType = z.infer<typeof unitTypeSchema>;
export type StockMode = z.infer<typeof stockModeSchema>;
export type CreateProduct = z.infer<typeof createProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type ProductFilters = z.infer<typeof productFiltersSchema>;
export type CreateVariant = z.input<typeof createVariantSchema>;
export type UpdateVariant = z.input<typeof updateVariantSchema>;
