import { z } from "@medusajs/framework/zod";

// Employee schemas
export const CreateEmployeeSchema = z.object({
	first_name: z.string().min(1, "First name is required"),
	last_name: z.string().min(1, "Last name is required"),
	pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
	role: z.enum(["cashier", "manager", "kitchen"]).default("cashier"),
	is_active: z.boolean().optional().default(true),
});

export type CreateEmployeeSchema = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = z.object({
	first_name: z.string().min(1).optional(),
	last_name: z.string().min(1).optional(),
	pin: z
		.string()
		.regex(/^\d{4,6}$/, "PIN must be 4-6 digits")
		.optional(),
	role: z.enum(["cashier", "manager", "kitchen"]).optional(),
	is_active: z.boolean().optional(),
});

export type UpdateEmployeeSchema = z.infer<typeof UpdateEmployeeSchema>;

// POS Order schemas
export const CreatePosOrderSchema = z.object({
	order_id: z.string().min(1, "Order ID is required"),
	created_by_id: z.string().min(1, "Created by employee ID is required"),
	assigned_to_id: z.string().optional(),
	pickup_date: z.string().optional(), // ISO date string
	pickup_time_start: z
		.string()
		.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
		.optional(),
	pickup_time_end: z
		.string()
		.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
		.optional(),
	client_note: z.string().optional(),
	internal_note: z.string().optional(),
});

export type CreatePosOrderSchema = z.infer<typeof CreatePosOrderSchema>;

export const UpdatePosOrderSchema = z.object({
	payment_status: z
		.enum(["pending", "paid", "partially_paid", "refunded"])
		.optional(),
	preparation_status: z
		.enum(["pending", "in_preparation", "ready", "picked_up"])
		.optional(),
	assigned_to_id: z.string().nullable().optional(),
	pickup_date: z.string().nullable().optional(),
	pickup_time_start: z
		.string()
		.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
		.nullable()
		.optional(),
	pickup_time_end: z
		.string()
		.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
		.nullable()
		.optional(),
	client_note: z.string().nullable().optional(),
	internal_note: z.string().nullable().optional(),
});

export type UpdatePosOrderSchema = z.infer<typeof UpdatePosOrderSchema>;

// Create POS Draft Order schema (creates both order and POS order)
export const CreatePosDraftOrderSchema = z.object({
	// Order fields
	region_id: z.string().min(1, "Region ID is required"),
	sales_channel_id: z.string().min(1, "Sales channel ID is required"),
	email: z.string().email("Valid email required").default("pos@store.local"),
	currency_code: z.string().min(1, "Currency code is required"),
	items: z
		.array(
			z.object({
				variant_id: z.string().min(1),
				quantity: z.number().min(1),
				unit_price: z.number().optional(),
			}),
		)
		.min(1, "At least one item is required"),
	customer_id: z.string().optional(),
	// POS fields
	created_by_id: z.string().min(1, "Created by employee ID is required"),
	assigned_to_id: z.string().optional(),
	pickup_date: z.string().optional(),
	pickup_time_start: z
		.string()
		.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
		.optional(),
	pickup_time_end: z
		.string()
		.regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid time format (HH:mm)")
		.optional(),
	client_note: z.string().optional(),
	internal_note: z.string().optional(),
	// Optional shipping address override
	shipping_address: z
		.object({
			first_name: z.string().optional(),
			last_name: z.string().optional(),
			address_1: z.string().optional(),
			city: z.string().optional(),
			postal_code: z.string().optional(),
			country_code: z.string().optional(),
			company: z.string().optional(),
			phone: z.string().optional(),
		})
		.optional(),
});

export type CreatePosDraftOrderSchema = z.infer<
	typeof CreatePosDraftOrderSchema
>;

// Query params schema for filtering POS orders
export const ListPosOrdersQuerySchema = z.object({
	payment_status: z
		.enum(["pending", "paid", "partially_paid", "refunded"])
		.optional(),
	preparation_status: z
		.enum(["pending", "in_preparation", "ready", "picked_up"])
		.optional(),
	created_by_id: z.string().optional(),
	assigned_to_id: z.string().optional(),
	pickup_date: z.string().optional(),
	limit: z.preprocess(
		(val) => (val && typeof val === "string" ? parseInt(val, 10) : val),
		z.number().optional().default(50),
	),
	offset: z.preprocess(
		(val) => (val && typeof val === "string" ? parseInt(val, 10) : val),
		z.number().optional().default(0),
	),
});

export type ListPosOrdersQuerySchema = z.infer<typeof ListPosOrdersQuerySchema>;
