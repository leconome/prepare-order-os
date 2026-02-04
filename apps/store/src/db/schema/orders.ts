import { pgTable, uuid, varchar, text, timestamp, decimal, pgEnum, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { employees } from "./employees.js";

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "partially_paid",
  "refunded",
]);

export const preparationStatusEnum = pgEnum("preparation_status", [
  "pending",
  "in_preparation",
  "ready",
  "picked_up",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: varchar("ticket_number", { length: 20 }).notNull().unique(),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
  preparationStatus: preparationStatusEnum("preparation_status").notNull().default("pending"),
  pickupDate: timestamp("pickup_date", { withTimezone: true }),
  pickupTimeStart: varchar("pickup_time_start", { length: 5 }),
  pickupTimeEnd: varchar("pickup_time_end", { length: 5 }),
  clientNote: text("client_note"),
  internalNote: text("internal_note"),
  createdById: uuid("created_by_id").references(() => employees.id),
  assignedToId: uuid("assigned_to_id").references(() => employees.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull().default("0.00"),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  createdBy: one(employees, {
    fields: [orders.createdById],
    references: [employees.id],
    relationName: "createdOrders",
  }),
  assignedTo: one(employees, {
    fields: [orders.assignedToId],
    references: [employees.id],
    relationName: "assignedOrders",
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
