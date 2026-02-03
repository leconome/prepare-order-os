import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type StoreAddress = {
	address_1: string;
	city: string;
	postal_code: string;
	country_code: string;
	company?: string;
};

export const getStoreAddressStep = createStep("get-store-address", async () => {
	const address: StoreAddress = {
		address_1: process.env.POS_STORE_ADDRESS_1 || "Adresse du magasin",
		city: process.env.POS_STORE_CITY || "Paris",
		postal_code: process.env.POS_STORE_POSTAL_CODE || "75001",
		country_code: process.env.POS_STORE_COUNTRY_CODE || "fr",
		company: process.env.POS_STORE_COMPANY || undefined,
	};

	return new StepResponse(address);
});
