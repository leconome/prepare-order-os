import {
	defineMiddlewares,
	validateAndTransformBody,
	validateAndTransformQuery,
} from "@medusajs/framework/http";
import {
	CreateEmployeeSchema,
	CreatePosDraftOrderSchema,
	CreatePosOrderSchema,
	ListPosOrdersQuerySchema,
	UpdateEmployeeSchema,
	UpdatePosOrderSchema,
} from "./admin/pos/validators";

export default defineMiddlewares({
	routes: [
		// Employee routes
		{
			matcher: "/admin/pos/employees",
			method: "POST",
			middlewares: [validateAndTransformBody(CreateEmployeeSchema)],
		},
		{
			matcher: "/admin/pos/employees/:id",
			method: "POST",
			middlewares: [validateAndTransformBody(UpdateEmployeeSchema)],
		},

		// POS Order routes
		{
			matcher: "/admin/pos/orders",
			method: "GET",
			middlewares: [validateAndTransformQuery(ListPosOrdersQuerySchema, {})],
		},
		{
			matcher: "/admin/pos/orders",
			method: "POST",
			middlewares: [validateAndTransformBody(CreatePosOrderSchema)],
		},
		{
			matcher: "/admin/pos/orders/:id",
			method: "POST",
			middlewares: [validateAndTransformBody(UpdatePosOrderSchema)],
		},

		// POS Draft Order (creates both order and POS order)
		{
			matcher: "/admin/pos/draft-orders",
			method: "POST",
			middlewares: [validateAndTransformBody(CreatePosDraftOrderSchema)],
		},
	],
});
