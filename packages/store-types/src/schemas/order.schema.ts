import { z } from "zod";

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

export const orderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.string(),
  totalPrice: z.string(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const orderSchema = z.object({
  id: z.string().uuid(),
  ticketNumber: z.string(),
  paymentStatus: paymentStatusSchema,
  preparationStatus: preparationStatusSchema,
  pickupDate: z.coerce.date().nullable(),
  pickupTimeStart: z.string().nullable(),
  pickupTimeEnd: z.string().nullable(),
  clientNote: z.string().nullable(),
  internalNote: z.string().nullable(),
  createdById: z.string().uuid().nullable(),
  assignedToId: z.string().uuid().nullable(),
  subtotal: z.string(),
  taxTotal: z.string(),
  total: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// Employee reference for relations
const employeeRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
}).nullable();

export const orderWithItemsSchema = orderSchema.extend({
  items: z.array(orderItemSchema),
  createdBy: employeeRefSchema.optional(),
  assignedTo: employeeRefSchema.optional(),
});

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

export type PaymentStatusType = z.infer<typeof paymentStatusSchema>;
export type PreparationStatusType = z.infer<typeof preparationStatusSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderWithItems = z.infer<typeof orderWithItemsSchema>;
export type CreateOrderItem = z.infer<typeof createOrderItemSchema>;
export type CreateOrder = z.infer<typeof createOrderSchema>;
export type UpdateOrder = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatus = z.infer<typeof updateOrderStatusSchema>;
export type OrderFilters = z.infer<typeof orderFiltersSchema>;
