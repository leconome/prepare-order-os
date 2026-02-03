import type {
	AuthenticatedMedusaRequest,
	MedusaResponse,
} from "@medusajs/framework/http";
import { POS_MODULE } from "../../../../modules/pos";
import type PosModuleService from "../../../../modules/pos/service";
import { createPosOrderWorkflow } from "../../../../workflows/create-pos-order";
import type { CreatePosOrderSchema } from "../validators";

// GET /admin/pos/orders - List POS orders with filters
export async function GET(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const posService: PosModuleService = req.scope.resolve(POS_MODULE);

	const {
		payment_status,
		preparation_status,
		created_by_id,
		assigned_to_id,
		pickup_date,
		limit = 50,
		offset = 0,
	} = req.validatedQuery as {
		payment_status?: string;
		preparation_status?: string;
		created_by_id?: string;
		assigned_to_id?: string;
		pickup_date?: string;
		limit?: number;
		offset?: number;
	};

	const filters: Record<string, unknown> = {};

	if (payment_status) filters.payment_status = payment_status;
	if (preparation_status) filters.preparation_status = preparation_status;
	if (created_by_id) filters.created_by_id = created_by_id;
	if (assigned_to_id) filters.assigned_to_id = assigned_to_id;
	if (pickup_date) {
		// Filter by specific pickup date
		const startOfDay = new Date(pickup_date);
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date(pickup_date);
		endOfDay.setHours(23, 59, 59, 999);
		filters.pickup_date = {
			$gte: startOfDay,
			$lte: endOfDay,
		};
	}

	const [orders, count] = await posService.listAndCountPosOrders(filters, {
		take: limit,
		skip: offset,
		order: { created_at: "DESC" },
		relations: ["created_by", "assigned_to"],
	});

	return res.json({
		pos_orders: orders,
		count,
		limit,
		offset,
	});
}

// POST /admin/pos/orders - Create a new POS order
export async function POST(
	req: AuthenticatedMedusaRequest<CreatePosOrderSchema>,
	res: MedusaResponse,
) {
	const {
		order_id,
		created_by_id,
		assigned_to_id,
		pickup_date,
		pickup_time_start,
		pickup_time_end,
		client_note,
		internal_note,
	} = req.validatedBody;

	const { result: posOrder } = await createPosOrderWorkflow(req.scope).run({
		input: {
			order_id,
			created_by_id,
			assigned_to_id,
			pickup_date,
			pickup_time_start,
			pickup_time_end,
			client_note,
			internal_note,
		},
	});

	return res.status(201).json({ pos_order: posOrder });
}
