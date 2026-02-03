import { model } from "@medusajs/framework/utils";
import PosOrder from "./pos-order";

const Employee = model.define("pos_employee", {
	id: model.id().primaryKey(),
	first_name: model.text(),
	last_name: model.text(),
	pin: model.text(), // 4-6 digit PIN for login
	role: model.enum(["cashier", "manager", "kitchen"]).default("cashier"),
	is_active: model.boolean().default(true),
	created_orders: model.hasMany(() => PosOrder, {
		mappedBy: "created_by",
	}),
	assigned_orders: model.hasMany(() => PosOrder, {
		mappedBy: "assigned_to",
	}),
});

export default Employee;
