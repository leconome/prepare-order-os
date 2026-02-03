import type {
	AuthenticatedMedusaRequest,
	MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";
import { POS_MODULE } from "../../../../../modules/pos";
import type PosModuleService from "../../../../../modules/pos/service";
import type { UpdateEmployeeSchema } from "../../validators";

// GET /admin/pos/employees/:id - Get employee by ID
export async function GET(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const { id } = req.params;
	const posService: PosModuleService = req.scope.resolve(POS_MODULE);

	try {
		const employee = await posService.retrieveEmployee(id);
		return res.json({ employee });
	} catch {
		throw new MedusaError(
			MedusaError.Types.NOT_FOUND,
			`Employee ${id} not found`,
		);
	}
}

// POST /admin/pos/employees/:id - Update an employee
export async function POST(
	req: AuthenticatedMedusaRequest<UpdateEmployeeSchema>,
	res: MedusaResponse,
) {
	const { id } = req.params;
	const posService: PosModuleService = req.scope.resolve(POS_MODULE);

	const { first_name, last_name, pin, role, is_active } = req.validatedBody;

	const updateData: Record<string, unknown> = { id };

	if (first_name !== undefined) updateData.first_name = first_name;
	if (last_name !== undefined) updateData.last_name = last_name;
	if (pin !== undefined) updateData.pin = pin;
	if (role !== undefined) updateData.role = role;
	if (is_active !== undefined) updateData.is_active = is_active;

	const employee = await posService.updateEmployees(updateData);

	return res.json({ employee });
}

// DELETE /admin/pos/employees/:id - Delete an employee
export async function DELETE(
	req: AuthenticatedMedusaRequest,
	res: MedusaResponse,
) {
	const { id } = req.params;
	const posService: PosModuleService = req.scope.resolve(POS_MODULE);

	await posService.deleteEmployees(id);

	return res.json({
		id,
		object: "pos_employee",
		deleted: true,
	});
}
