import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { POS_MODULE } from "../../modules/pos"
import PosModuleService from "../../modules/pos/service"

export type UpdatePosOrderStatusStepInput = {
  pos_order_id: string
  payment_status?: string
  preparation_status?: string
  assigned_to_id?: string | null
}

export const updatePosOrderStatusStep = createStep(
  "update-pos-order-status-step",
  async (input: UpdatePosOrderStatusStepInput, { container }) => {
    const posService: PosModuleService = container.resolve(POS_MODULE)

    // Get current state for compensation
    const currentOrder = await posService.retrievePosOrder(input.pos_order_id)

    const previousState = {
      id: currentOrder.id,
      payment_status: currentOrder.payment_status,
      preparation_status: currentOrder.preparation_status,
      assigned_to_id: currentOrder.assigned_to_id,
    }

    // Update the POS order status
    const updateData: Record<string, unknown> = {
      id: input.pos_order_id,
    }

    if (input.payment_status !== undefined) {
      updateData.payment_status = input.payment_status
    }

    if (input.preparation_status !== undefined) {
      updateData.preparation_status = input.preparation_status
    }

    if (input.assigned_to_id !== undefined) {
      updateData.assigned_to_id = input.assigned_to_id
    }

    const updatedOrder = await posService.updatePosOrders(updateData)

    return new StepResponse(updatedOrder, previousState)
  },
  // Compensation function for rollback
  async (previousState, { container }) => {
    if (!previousState) return

    const posService: PosModuleService = container.resolve(POS_MODULE)
    await posService.updatePosOrders({
      id: previousState.id,
      payment_status: previousState.payment_status,
      preparation_status: previousState.preparation_status,
      assigned_to_id: previousState.assigned_to_id,
    })
  }
)
