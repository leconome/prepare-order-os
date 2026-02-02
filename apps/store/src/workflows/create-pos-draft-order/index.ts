import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { createOrderWorkflow, createRemoteLinkStep } from "@medusajs/medusa/core-flows"
import { Modules } from "@medusajs/framework/utils"
import { createPosOrderStep } from "../steps/create-pos-order"
import { getStoreAddressStep } from "../steps/get-store-address"
import { getVariantDetailsStep } from "../steps/get-variant-details"
import { POS_MODULE } from "../../modules/pos"

export type CreatePosDraftOrderInput = {
  // Order fields
  region_id: string
  sales_channel_id: string
  email: string
  currency_code: string
  items: Array<{
    variant_id: string
    quantity: number
    unit_price?: number
  }>
  customer_id?: string
  // POS fields
  created_by_id: string
  assigned_to_id?: string
  pickup_date?: string
  pickup_time_start?: string
  pickup_time_end?: string
  client_note?: string
  internal_note?: string
  // Optional address override
  shipping_address?: {
    first_name?: string
    last_name?: string
    address_1?: string
    city?: string
    postal_code?: string
    country_code?: string
    company?: string
    phone?: string
  }
}

export const createPosDraftOrderWorkflow = createWorkflow(
  "create-pos-draft-order",
  function (input: CreatePosDraftOrderInput) {
    // Step 1: Get store address from env
    const storeAddress = getStoreAddressStep()

    // Step 2: Get variant details (titles)
    const variantDetailsInput = transform({ input }, ({ input }) => ({
      items: input.items,
    }))
    const itemsWithDetails = getVariantDetailsStep(variantDetailsInput)

    // Step 3: Build order input with pre-filled shipping address
    const orderInput = transform(
      { input, storeAddress, itemsWithDetails },
      ({ input, storeAddress, itemsWithDetails }) => {
        // Use provided address or fall back to store address
        const shippingAddress = {
          first_name: input.shipping_address?.first_name || "Client",
          last_name: input.shipping_address?.last_name || "POS",
          address_1: input.shipping_address?.address_1 || storeAddress.address_1,
          city: input.shipping_address?.city || storeAddress.city,
          postal_code: input.shipping_address?.postal_code || storeAddress.postal_code,
          country_code: input.shipping_address?.country_code || storeAddress.country_code,
          company: input.shipping_address?.company || storeAddress.company,
          phone: input.shipping_address?.phone,
        }

        return {
          region_id: input.region_id,
          sales_channel_id: input.sales_channel_id,
          email: input.email,
          currency_code: input.currency_code,
          customer_id: input.customer_id,
          items: itemsWithDetails.map((item) => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            title: item.title,
          })),
          status: "draft" as const,
          shipping_address: shippingAddress,
          billing_address: shippingAddress,
          no_notification: true,
        }
      }
    )

    // Step 4: Create the draft order
    const order = createOrderWorkflow.runAsStep({
      input: orderInput,
    })

    // Step 5: Extract order ID for POS order creation
    const posOrderInput = transform(
      { order, input },
      ({ order, input }) => ({
        order_id: order.id,
        created_by_id: input.created_by_id,
        assigned_to_id: input.assigned_to_id,
        pickup_date: input.pickup_date,
        pickup_time_start: input.pickup_time_start,
        pickup_time_end: input.pickup_time_end,
        client_note: input.client_note,
        internal_note: input.internal_note,
      })
    )

    // Step 6: Create the POS order
    const posOrder = createPosOrderStep(posOrderInput)

    // Step 7: Create link between POS order and Medusa order
    const linkData = transform({ posOrder, order }, ({ posOrder, order }) => [
      {
        [POS_MODULE]: {
          pos_order_id: posOrder.id,
        },
        [Modules.ORDER]: {
          order_id: order.id,
        },
      },
    ])

    createRemoteLinkStep(linkData)

    // Return both the order and POS order
    const result = transform({ order, posOrder }, ({ order, posOrder }) => ({
      order,
      pos_order: posOrder,
    }))

    return new WorkflowResponse(result)
  }
)

export default createPosDraftOrderWorkflow
