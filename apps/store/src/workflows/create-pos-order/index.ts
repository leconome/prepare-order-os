import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createPosOrderStep, CreatePosOrderStepInput } from "../steps/create-pos-order"
import { POS_MODULE } from "../../modules/pos"

export type CreatePosOrderWorkflowInput = CreatePosOrderStepInput

export const createPosOrderWorkflow = createWorkflow(
  "create-pos-order",
  function (input: CreatePosOrderWorkflowInput) {
    // Create the POS order
    const posOrder = createPosOrderStep(input)

    // Create link between POS order and Medusa order
    // Order must match defineLink: posOrder first, then order
    const linkData = transform({ posOrder, input }, ({ posOrder, input }) => [
      {
        [POS_MODULE]: {
          pos_order_id: posOrder.id,
        },
        [Modules.ORDER]: {
          order_id: input.order_id,
        },
      },
    ])

    createRemoteLinkStep(linkData)

    return new WorkflowResponse(posOrder)
  }
)

export default createPosOrderWorkflow
