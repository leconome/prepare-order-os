import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { createPosDraftOrderWorkflow } from "../../../../workflows/create-pos-draft-order"
import type { CreatePosDraftOrderSchema } from "../validators"

export async function POST(
  req: AuthenticatedMedusaRequest<CreatePosDraftOrderSchema>,
  res: MedusaResponse
) {
  const { result } = await createPosDraftOrderWorkflow(req.scope).run({
    input: req.validatedBody,
  })

  res.json(result)
}
