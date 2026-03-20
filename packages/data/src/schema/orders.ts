import { relations } from "drizzle-orm";
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { type UserRef, users } from "./auth.js";
import { type Client, clients } from "./clients.js";
import { type PointOfSale, pointsOfSale } from "./points-of-sale.js";
import { productVariants } from "./product-variants.js";
import { unitTypeEnum, unitTypeSchema } from "./products.js";
import { tenants } from "./tenants.js";

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

export const orderSourceEnum = pgEnum("order_source", [
  "comptoir",
  "telephone",
  "site_web",
]);

export const discountTypeEnum = pgEnum("discount_type", [
  "percentage",
  "fixed",
]);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: varchar("ticket_number", { length: 20 }).notNull(),
    // Reference to client
    clientId: uuid("client_id").references(() => clients.id),
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
    // References to users table (text ID from better-auth)
    createdById: text("created_by_id").references(() => users.id),
    assignedToId: text("assigned_to_id").references(() => users.id),
    posId: uuid("pos_id").references(() => pointsOfSale.id, {
      onDelete: "set null",
    }),
    source: orderSourceEnum("source").notNull().default("comptoir"),
    subtotal: decimal("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    discountType: discountTypeEnum("discount_type"),
    discountValue: decimal("discount_value", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    discountAmount: decimal("discount_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    taxTotal: decimal("tax_total", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    total: decimal("total", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    paidAmount: decimal("paid_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0.00"),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    smsNotifiedAt: timestamp("sms_notified_at", { withTimezone: true }),
    emailNotifiedAt: timestamp("email_notified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orders_tenant_id_idx").on(table.tenantId),
    unique("orders_tenant_ticket_unique").on(
      table.tenantId,
      table.ticketNumber,
    ),
  ],
);

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  variantId: uuid("variant_id").references(() => productVariants.id, {
    onDelete: "set null",
  }),
  variantName: varchar("variant_name", { length: 200 }),
  quantity: decimal("quantity", { precision: 10, scale: 3 })
    .notNull()
    .default("1"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  unit: unitTypeEnum("unit").notNull().default("piece"),
  isMenu: boolean("is_menu").notNull().default(false),
  isPrepared: boolean("is_prepared").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderMenuItems = pgTable("order_menu_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull(),
  productName: varchar("product_name", { length: 200 }).notNull(),
  quantity: integer("quantity").notNull().default(1),
  isPrepared: boolean("is_prepared").notNull().default(false),
});

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(clients, {
    fields: [orders.clientId],
    references: [clients.id],
  }),
  createdBy: one(users, {
    fields: [orders.createdById],
    references: [users.id],
    relationName: "createdOrders",
  }),
  assignedTo: one(users, {
    fields: [orders.assignedToId],
    references: [users.id],
    relationName: "assignedOrders",
  }),
  pointOfSale: one(pointsOfSale, {
    fields: [orders.posId],
    references: [pointsOfSale.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  menuItems: many(orderMenuItems),
}));

export const orderMenuItemsRelations = relations(orderMenuItems, ({ one }) => ({
  orderItem: one(orderItems, {
    fields: [orderMenuItems.orderItemId],
    references: [orderItems.id],
  }),
}));

// Drizzle types
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;
export type OrderMenuItem = typeof orderMenuItems.$inferSelect;
export type NewOrderMenuItem = typeof orderMenuItems.$inferInsert;

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
  variantId: z.string().uuid().optional(),
  variantName: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.string(),
  unit: unitTypeSchema.default("piece"),
  notes: z.string().optional(),
  menuId: z.string().uuid().optional(),
});

export const orderSourceSchema = z.enum(["comptoir", "telephone", "site_web"]);

export const discountTypeSchema = z.enum(["percentage", "fixed"]);

export const createOrderSchema = z.object({
  clientId: z.string().uuid().optional(),
  pickupDate: z.coerce.date(),
  pickupTimeStart: z.string().optional(),
  pickupTimeEnd: z.string().optional(),
  clientNote: z.string().optional(),
  internalNote: z.string().optional(),
  // createdById is auto-filled from logged-in user, but can be overridden
  createdById: z.string().optional(),
  assignedToId: z.string().optional(),
  posId: z.string().uuid().nullable().optional(),
  source: orderSourceSchema.optional(),
  discountType: discountTypeSchema.nullable().optional(),
  discountValue: z.string().optional(),
  items: z.array(createOrderItemSchema).min(1),
});

export const updateOrderSchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  paymentStatus: paymentStatusSchema.optional(),
  preparationStatus: preparationStatusSchema.optional(),
  pickupDate: z.coerce.date().nullable().optional(),
  pickupTimeStart: z.string().nullable().optional(),
  pickupTimeEnd: z.string().nullable().optional(),
  clientNote: z.string().nullable().optional(),
  internalNote: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  posId: z.string().uuid().nullable().optional(),
  source: orderSourceSchema.optional(),
  smsNotifiedAt: z.coerce.date().nullable().optional(),
  emailNotifiedAt: z.coerce.date().nullable().optional(),
  discountType: discountTypeSchema.nullable().optional(),
  discountValue: z.string().nullable().optional(),
  paidAmount: z.string().nullable().optional(),
  items: z.array(createOrderItemSchema).min(1).optional(),
});

export const updateOrderStatusSchema = z.object({
  paymentStatus: paymentStatusSchema.optional(),
  preparationStatus: preparationStatusSchema.optional(),
  paidAmount: z.string().optional(),
});

export const orderFiltersSchema = z.object({
  search: z.string().optional(),
  clientId: z.string().uuid().optional(),
  paymentStatus: paymentStatusSchema.optional(),
  preparationStatus: preparationStatusSchema.optional(),
  createdById: z.string().optional(),
  assignedToId: z.string().optional(),
  posId: z.string().uuid().optional(),
  pickupDate: z.coerce.date().optional(),
  pickupDateFrom: z.coerce.date().optional(),
  pickupDateTo: z.coerce.date().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
});

// Client reference type (minimal info for display)
export type ClientRef = Pick<Client, "id" | "name" | "phone" | "email">;

// Point of sale reference type (minimal info for display)
export type PointOfSaleRef = Pick<PointOfSale, "id" | "name" | "type">;

// Types
export type OrderItemWithMenuItems = OrderItem & {
  menuItems?: OrderMenuItem[];
};
export type OrderWithItems = Order & {
  items: OrderItemWithMenuItems[];
  client?: ClientRef | null;
  createdBy?: UserRef;
  assignedTo?: UserRef;
  pointOfSale?: PointOfSaleRef | null;
};
export type OrderSourceType = z.infer<typeof orderSourceSchema>;
export type PaymentStatusType = z.infer<typeof paymentStatusSchema>;
export type PreparationStatusType = z.infer<typeof preparationStatusSchema>;
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type OrderFilters = z.infer<typeof orderFiltersSchema>;

export const updateOrderItemsSchema = z.object({
  items: z.array(createOrderItemSchema).min(1),
});
export type UpdateOrderItems = z.infer<typeof updateOrderItemsSchema>;

export const toggleItemPreparedSchema = z.object({
  isPrepared: z.boolean(),
});
export type ToggleItemPrepared = z.infer<typeof toggleItemPreparedSchema>;
