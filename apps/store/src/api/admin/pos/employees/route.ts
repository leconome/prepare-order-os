import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { POS_MODULE } from "../../../../modules/pos"
import PosModuleService from "../../../../modules/pos/service"
import { CreateEmployeeSchema } from "../validators"

// GET /admin/pos/employees - List all employees
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const posService: PosModuleService = req.scope.resolve(POS_MODULE)

  const [employees, count] = await posService.listAndCountEmployees(
    {},
    {
      order: { created_at: "DESC" },
    }
  )

  return res.json({
    employees,
    count,
  })
}

// POST /admin/pos/employees - Create a new employee
export async function POST(
  req: AuthenticatedMedusaRequest<CreateEmployeeSchema>,
  res: MedusaResponse
) {
  const posService: PosModuleService = req.scope.resolve(POS_MODULE)

  const { first_name, last_name, pin, role, is_active } = req.validatedBody

  const employee = await posService.createEmployees({
    first_name,
    last_name,
    pin,
    role,
    is_active,
  })

  return res.status(201).json({ employee })
}
