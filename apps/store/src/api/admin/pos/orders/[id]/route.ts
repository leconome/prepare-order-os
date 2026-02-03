import type {
	AuthenticatedMedusaRequest,
	MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { POS_MODULE } from "../../../../../modules/pos";
import type PosModuleService from "../../../../../modules/pos/service";
import { updatePosOrderStatusWorkflow } from "../../../../../workflows/update-pos-order-status";
import type { UpdatePosOrderSchema } from "../../validators";

// GET /admin/pos/orders/:id - Get POS order by ID
export async function GET(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const { id } = req.params;
	const posService: PosModuleService = req.scope.resolve(POS_MODULE);

	try {
		const posOrder = await posService.retrievePosOrder(id, {
			relations: ["created_by", "assigned_to"],
		});
		return res.json({ pos_order: posOrder });
	} catch {
		throw new MedusaError(
			MedusaError.Types.NOT_FOUND,
			`POS Order ${id} not found`,
		);
	}
}

// POST /admin/pos/orders/:id - Update a POS order
export async function POST(
	req: AuthenticatedMedusaRequest<UpdatePosOrderSchema>,
	res: MedusaResponse,
) {
	const { id } = req.params;
	const posService: PosModuleService = req.scope.resolve(POS_MODULE);

	const {
		payment_status,
		preparation_status,
		assigned_to_id,
		pickup_date,
		pickup_time_start,
		pickup_time_end,
		client_note,
		internal_note,
	} = req.validatedBody;

	// For status updates, use the workflow
	if (
		payment_status !== undefined ||
		preparation_status !== undefined ||
		assigned_to_id !== undefined
	) {
		const { result: posOrder } = await updatePosOrderStatusWorkflow(
			req.scope,
		).run({
			input: {
				pos_order_id: id,
				payment_status,
				preparation_status,
				assigned_to_id,
			},
		});

		// Handle other non-status updates separately
		if (
			pickup_date !== undefined ||
			pickup_time_start !== undefined ||
			pickup_time_end !== undefined ||
			client_note !== undefined ||
			internal_note !== undefined
		) {
			const updateData: Record<string, unknown> = { id: posOrder.id };

			if (pickup_date !== undefined) {
				updateData.pickup_date = pickup_date ? new Date(pickup_date) : null;
			}
			if (pickup_time_start !== undefined) {
				updateData.pickup_time_start = pickup_time_start;
			}
			if (pickup_time_end !== undefined) {
				updateData.pickup_time_end = pickup_time_end;
			}
			if (client_note !== undefined) {
				updateData.client_note = client_note;
			}
			if (internal_note !== undefined) {
				updateData.internal_note = internal_note;
			}

			const updatedOrder = await posService.updatePosOrders(updateData);
			return res.json({ pos_order: updatedOrder });
		}

		return res.json({ pos_order: posOrder });
	}

	// Direct update for non-status fields
	const updateData: Record<string, unknown> = { id };

	if (pickup_date !== undefined) {
		updateData.pickup_date = pickup_date ? new Date(pickup_date) : null;
	}
	if (pickup_time_start !== undefined) {
		updateData.pickup_time_start = pickup_time_start;
	}
	if (pickup_time_end !== undefined) {
		updateData.pickup_time_end = pickup_time_end;
	}
	if (client_note !== undefined) {
		updateData.client_note = client_note;
	}
	if (internal_note !== undefined) {
		updateData.internal_note = internal_note;
	}

	const posOrder = await posService.updatePosOrders(updateData);

	return res.json({ pos_order: posOrder });
}
