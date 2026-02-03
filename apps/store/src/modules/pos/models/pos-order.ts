import { model } from "@medusajs/framework/utils";
import Employee from "./employee";

const PosOrder = model.define("pos_order", {
	id: model.id().primaryKey(),
	ticket_number: model.text().unique().index("IDX_pos_order_ticket_number"),
	payment_status: model
		.enum(["pending", "paid", "partially_paid", "refunded"])
		.default("pending"),
	preparation_status: model
		.enum(["pending", "in_preparation", "ready", "picked_up"])
		.default("pending"),
	pickup_date: model.dateTime().nullable(),
	pickup_time_start: model.text().nullable(), // Format: "HH:mm"
	pickup_time_end: model.text().nullable(), // Format: "HH:mm"
	client_note: model.text().nullable(),
	internal_note: model.text().nullable(),
	order_id: model.text(), // Medusa Order ID (linked via module link)
	created_by: model.belongsTo(() => Employee, {
		mappedBy: "created_orders",
	}),
	assigned_to: model
		.belongsTo(() => Employee, {
			mappedBy: "assigned_orders",
		})
		.nullable(),
});

export default PosOrder;
