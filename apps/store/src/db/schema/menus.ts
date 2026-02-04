import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { products } from "./products.js";

export const menus = pgTable("menus", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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

export type Menu = typeof menus.$inferSelect;
export type NewMenu = typeof menus.$inferInsert;
export type MenuProduct = typeof menuProducts.$inferSelect;
export type NewMenuProduct = typeof menuProducts.$inferInsert;
