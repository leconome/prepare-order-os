import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { products, type Product } from "./products.js";
import { tenants } from "./tenants.js";

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
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
  (table) => [index("menus_tenant_id_idx").on(table.tenantId)],
);

export const menuProducts = pgTable(
  "menu_products",
  {
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.menuId, table.productId] })],
);

export const menusRelations = relations(menus, ({ many }) => ({
  menuProducts: many(menuProducts),
}));

export const menuProductsRelations = relations(menuProducts, ({ one }) => ({
  menu: one(menus, {
    fields: [menuProducts.menuId],
    references: [menus.id],
  }),
  product: one(products, {
    fields: [menuProducts.productId],
    references: [products.id],
  }),
}));

// Drizzle types
export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;
export type MenuProduct = typeof menuProducts.$inferSelect;
export type NewMenuProduct = typeof menuProducts.$inferInsert;

// Zod schemas from drizzle-zod
export const insertMenuSchema = createInsertSchema(menus);
export const selectMenuSchema = createSelectSchema(menus);
export const insertMenuProductSchema = createInsertSchema(menuProducts);
export const selectMenuProductSchema = createSelectSchema(menuProducts);

// Custom schemas for API
export const createMenuSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  productIds: z.array(z.string().uuid()).optional(),
});

export const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

export const menuFiltersSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Types
export type MenuWithProducts = Menu & { products: Product[] };
export type CreateMenu = z.infer<typeof createMenuSchema>;
export type UpdateMenu = z.infer<typeof updateMenuSchema>;
export type MenuFilters = z.infer<typeof menuFiltersSchema>;
