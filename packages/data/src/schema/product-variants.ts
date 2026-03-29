import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { products } from "./products.js";
import { tenants } from "./tenants.js";

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    price: decimal("price", { precision: 10, scale: 2 }).notNull(),
    stock: decimal("stock", { precision: 10, scale: 3 }),
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
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_tenant_id_idx").on(table.tenantId),
  ],
);

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  }),
);

// Drizzle types
export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

// Zod schemas
export const createVariantSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Invalid price format").transform((v) => v.replace(",", ".")),
  stock: z.number().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updateVariantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  price: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Invalid price format").transform((v) => v.replace(",", "."))
    .optional(),
  stock: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// Bulk create/update for product form
export const upsertVariantsSchema = z.array(
  z.object({
    id: z.string().uuid().optional(), // present = update, absent = create
    name: z.string().min(1).max(200),
    price: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Invalid price format").transform((v) => v.replace(",", ".")),
    stock: z.number().min(0).nullable().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  }),
);

export type CreateVariant = z.infer<typeof createVariantSchema>;
export type UpdateVariant = z.infer<typeof updateVariantSchema>;
export type UpsertVariants = z.infer<typeof upsertVariantsSchema>;
