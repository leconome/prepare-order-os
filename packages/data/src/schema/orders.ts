import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  decimal,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
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
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("pending"),
  preparationStatus: preparationStatusEnum("preparation_status")
    .notNull()
    .default("pending"),
  pickupDate: timestamp("pickup_date", { withTimezone: true }),
  pickupTimeStart: varchar("pickup_time_start", { length: 5 }),
  pickupTimeEnd: varchar("pickup_time_end", { length: 5 }),
  clientNote: text("client_note"),
  internalNote: text("internal_note"),
  createdById: uuid("created_by_id").references(() => employees.id),
  assignedToId: uuid("assigned_to_id").references(() => employees.id),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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

// Drizzle types
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

// Zod schemas from drizzle-zod
export const insertOrderSchema = createInsertSchema(orders);
export const selectOrderSchema = createSelectSchema(orders);
export const insertOrderItemSchema = createInsertSchema(orderItems);
export const selectOrderItemSchema = createSelectSchema(orderItems);

// Status schemas
export const paymentStatusSchema = z.enum([
  "pending",
  "paid",
  "partially_paid",
  "refunded",
]);

export const preparationStatusSchema = z.enum([
  "pending",
  "in_preparation",
  "ready",
  "picked_up",
]);

// Custom schemas for API
export const createOrderItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.string(),
  notes: z.string().optional(),
});

export const createOrderSchema = z.object({
  pickupDate: z.coerce.date().optional(),
  pickupTimeStart: z.string().optional(),
  pickupTimeEnd: z.string().optional(),
  clientNote: z.string().optional(),
  internalNote: z.string().optional(),
  createdById: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  items: z.array(createOrderItemSchema).min(1),
});

export const updateOrderSchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  preparationStatus: preparationStatusSchema.optional(),
  pickupDate: z.coerce.date().nullable().optional(),
  pickupTimeStart: z.string().nullable().optional(),
  pickupTimeEnd: z.string().nullable().optional(),
  clientNote: z.string().nullable().optional(),
  internalNote: z.string().nullable().optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

export const updateOrderStatusSchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  preparationStatus: preparationStatusSchema.optional(),
});

export const orderFiltersSchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  preparationStatus: preparationStatusSchema.optional(),
  createdById: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
  pickupDate: z.coerce.date().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Employee reference type for relations
export type EmployeeRef = {
  id: string;
  name: string;
} | null;

// Types
export type OrderWithItems = Order & {
  items: OrderItem[];
  createdBy?: EmployeeRef;
  assignedTo?: EmployeeRef;
};
export type PaymentStatusType = z.infer<typeof paymentStatusSchema>;
export type PreparationStatusType = z.infer<typeof preparationStatusSchema>;
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
