import { Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type GetVariantDetailsInput = {
	items: Array<{
		variant_id: string;
		quantity: number;
		unit_price?: number;
	}>;
};

export type VariantWithDetails = {
	variant_id: string;
	quantity: number;
	unit_price: number;
	title: string;
};

export const getVariantDetailsStep = createStep(
	"get-variant-details",
	async (input: GetVariantDetailsInput, { container }) => {
		const productModuleService = container.resolve(Modules.PRODUCT);

		const variantIds = input.items.map((item) => item.variant_id);

		const variants = await productModuleService.listProductVariants(
			{ id: variantIds },
			{ relations: ["product"] },
		);

		const variantMap = new Map(variants.map((v) => [v.id, v]));

		const itemsWithDetails: VariantWithDetails[] = input.items.map((item) => {
			const variant = variantMap.get(item.variant_id);
			const productTitle = (variant as any)?.product?.title || "Product";
			const variantTitle = variant?.title || "";
			const title =
				variantTitle && variantTitle !== "Default"
					? `${productTitle} - ${variantTitle}`
					: productTitle;

			return {
				variant_id: item.variant_id,
				quantity: item.quantity,
				unit_price: item.unit_price || 0,
				title,
			};
		});

		return new StepResponse(itemsWithDetails);
	},
);
