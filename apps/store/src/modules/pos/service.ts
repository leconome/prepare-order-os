import { MedusaService } from "@medusajs/framework/utils";
import Employee from "./models/employee";
import PosOrder from "./models/pos-order";
import TicketCounter from "./models/ticket-counter";

class PosModuleService extends MedusaService({
	Employee,
	PosOrder,
	TicketCounter,
}) {
	/**
	 * Generates a unique ticket number for the current day
	 * Format: YYMMdd:XXX (e.g., "250202:001")
	 * Thread-safe using database upsert
	 */
	async generateTicketNumber(): Promise<string> {
		const now = new Date();
		const dateKey = this.formatDateKey(now);

		// Get or create counter for today
		const existingCounters = await this.listTicketCounters({
			date_key: dateKey,
		});

		let counter: { id: string; date_key: string; current_number: number };

		if (existingCounters.length > 0) {
			// Update existing counter
			counter = await this.updateTicketCounters({
				id: existingCounters[0].id,
				current_number: existingCounters[0].current_number + 1,
			});
		} else {
			// Create new counter for today
			counter = await this.createTicketCounters({
				date_key: dateKey,
				current_number: 1,
			});
		}

		// Format: YYMMdd:XXX
		const ticketNumber = `${dateKey}:${String(counter.current_number).padStart(3, "0")}`;
		return ticketNumber;
	}

	/**
	 * Format date as YYMMDD
	 */
	private formatDateKey(date: Date): string {
		const year = String(date.getFullYear()).slice(-2);
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}${month}${day}`;
	}
}

export default PosModuleService;
