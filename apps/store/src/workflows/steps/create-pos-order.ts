import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { POS_MODULE } from "../../modules/pos";
import type PosModuleService from "../../modules/pos/service";

export type CreatePosOrderStepInput = {
	order_id: string;
	created_by_id: string;
	assigned_to_id?: string;
	pickup_date?: string;
	pickup_time_start?: string;
	pickup_time_end?: string;
	client_note?: string;
	internal_note?: string;
};

export const createPosOrderStep = createStep(
	"create-pos-order-step",
	async (input: CreatePosOrderStepInput, { container }) => {
		const posService: PosModuleService = container.resolve(POS_MODULE);

		// Generate ticket number
		const ticketNumber = await posService.generateTicketNumber();

		// Create the POS order
		const posOrder = await posService.createPosOrders({
			ticket_number: ticketNumber,
			order_id: input.order_id,
			created_by_id: input.created_by_id,
			assigned_to_id: input.assigned_to_id,
			pickup_date: input.pickup_date ? new Date(input.pickup_date) : null,
			pickup_time_start: input.pickup_time_start,
			pickup_time_end: input.pickup_time_end,
			client_note: input.client_note,
			internal_note: input.internal_note,
			payment_status: "pending",
			preparation_status: "pending",
		});

		return new StepResponse(posOrder, posOrder.id);
	},
	// Compensation function for rollback
	async (posOrderId: string, { container }) => {
		const posService: PosModuleService = container.resolve(POS_MODULE);
		await posService.deletePosOrders(posOrderId);
	},
);
