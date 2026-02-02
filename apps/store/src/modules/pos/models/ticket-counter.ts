import { model } from "@medusajs/framework/utils"

const TicketCounter = model.define("pos_ticket_counter", {
  id: model.id().primaryKey(),
  date_key: model.text().unique(), // Format: YYMMDD (e.g., "250202")
  current_number: model.number().default(0),
})

export default TicketCounter
