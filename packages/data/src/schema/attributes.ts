import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { tenants } from "./tenants.js";

export const productAttributes = pgTable(
  "product_attributes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    wooId: integer("woo_id"),
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
    index("product_attributes_tenant_id_idx").on(table.tenantId),
    uniqueIndex("product_attributes_tenant_woo_id_idx").on(
      table.tenantId,
      table.wooId,
    ),
  ],
);

export const attributeTerms = pgTable(
  "attribute_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attributeId: uuid("attribute_id")
      .notNull()
      .references(() => productAttributes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    wooId: integer("woo_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("attribute_terms_attribute_id_idx").on(table.attributeId)],
);

export const productAttributesRelations = relations(
  productAttributes,
  ({ many }) => ({
    terms: many(attributeTerms),
  }),
);

export const attributeTermsRelations = relations(
  attributeTerms,
  ({ one }) => ({
    attribute: one(productAttributes, {
      fields: [attributeTerms.attributeId],
      references: [productAttributes.id],
    }),
  }),
);

// Drizzle types
export type ProductAttribute = typeof productAttributes.$inferSelect;
export type NewProductAttribute = typeof productAttributes.$inferInsert;
export type AttributeTerm = typeof attributeTerms.$inferSelect;
export type NewAttributeTerm = typeof attributeTerms.$inferInsert;

export type ProductAttributeWithTerms = ProductAttribute & {
  terms: AttributeTerm[];
};

// Zod schemas
export const createAttributeSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional().default(0),
});

export const updateAttributeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export const createTermSchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional().default(0),
});

export const updateTermSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

// Types
export type CreateAttribute = z.input<typeof createAttributeSchema>;
export type UpdateAttribute = z.input<typeof updateAttributeSchema>;
export type CreateTerm = z.input<typeof createTermSchema>;
export type UpdateTerm = z.input<typeof updateTermSchema>;
