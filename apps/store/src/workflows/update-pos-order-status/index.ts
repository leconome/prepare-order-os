import {
	createWorkflow,
	WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
	type UpdatePosOrderStatusStepInput,
	updatePosOrderStatusStep,
} from "../steps/update-pos-order-status";

export type UpdatePosOrderStatusWorkflowInput = UpdatePosOrderStatusStepInput;

export const updatePosOrderStatusWorkflow = createWorkflow(
	"update-pos-order-status",
	(input: UpdatePosOrderStatusWorkflowInput) => {
		const updatedOrder = updatePosOrderStatusStep(input);

		return new WorkflowResponse(updatedOrder);
	},
);

export default updatePosOrderStatusWorkflow;
