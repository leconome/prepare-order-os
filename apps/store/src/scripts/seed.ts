import type { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
	createWorkflow,
	transform,
	WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
	createApiKeysWorkflow,
	createRegionsWorkflow,
	createSalesChannelsWorkflow,
	createShippingOptionsWorkflow,
	createShippingProfilesWorkflow,
	createStockLocationsWorkflow,
	createTaxRegionsWorkflow,
	linkSalesChannelsToApiKeyWorkflow,
	linkSalesChannelsToStockLocationWorkflow,
	updateStoresStep,
	updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import type { ApiKey } from "../../.medusa/types/query-entry-points";

const updateStoreCurrencies = createWorkflow(
	"update-store-currencies",
	(input: {
		supported_currencies: { currency_code: string; is_default?: boolean }[];
		store_id: string;
	}) => {
		const normalizedInput = transform({ input }, (data) => {
			return {
				selector: { id: data.input.store_id },
				update: {
					supported_currencies: data.input.supported_currencies.map(
						(currency) => {
							return {
								currency_code: currency.currency_code,
								is_default: currency.is_default ?? false,
							};
						},
					),
				},
			};
		});

		const stores = updateStoresStep(normalizedInput);

		return new WorkflowResponse(stores);
	},
);

export default async function seedDemoData({ container }: ExecArgs) {
	const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
	const link = container.resolve(ContainerRegistrationKeys.LINK);
	const query = container.resolve(ContainerRegistrationKeys.QUERY);
	const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
	const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
	const storeModuleService = container.resolve(Modules.STORE);

	const countries = ["fr", "be", "ch", "lu", "mc"];

	logger.info("Setting up store configuration...");
	const [store] = await storeModuleService.listStores();
	const regionModuleService = container.resolve(Modules.REGION);

	// Check existing data
	let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
		name: "Default Sales Channel",
	});

	const existingRegions = await regionModuleService.listRegions({
		name: "France",
	});

	if (defaultSalesChannel.length && existingRegions.length) {
		logger.info("Store already configured, skipping seed.");
		return;
	}

	// Create default sales channel if it doesn't exist
	if (!defaultSalesChannel.length) {
		const { result: salesChannelResult } = await createSalesChannelsWorkflow(
			container,
		).run({
			input: {
				salesChannelsData: [
					{
						name: "Default Sales Channel",
					},
				],
			},
		});
		defaultSalesChannel = salesChannelResult;
	}

	// Set up currencies
	await updateStoreCurrencies(container).run({
		input: {
			store_id: store.id,
			supported_currencies: [
				{
					currency_code: "eur",
					is_default: true,
				},
			],
		},
	});

	await updateStoresWorkflow(container).run({
		input: {
			selector: { id: store.id },
			update: {
				default_sales_channel_id: defaultSalesChannel[0].id,
			},
		},
	});

	// Create region if it doesn't exist
	let region = existingRegions[0];
	if (!region) {
		logger.info("Creating default region...");
		const { result: regionResult } = await createRegionsWorkflow(container).run(
			{
				input: {
					regions: [
						{
							name: "France",
							currency_code: "eur",
							countries,
							payment_providers: ["pp_system_default"],
						},
					],
				},
			},
		);
		region = regionResult[0];
	} else {
		logger.info("Region 'France' already exists, skipping...");
	}

	// Create tax regions
	logger.info("Creating tax regions...");
	await createTaxRegionsWorkflow(container).run({
		input: countries.map((country_code) => ({
			country_code,
			provider_id: "tp_system",
		})),
	});

	// Create stock location
	logger.info("Creating stock location...");
	const { result: stockLocationResult } = await createStockLocationsWorkflow(
		container,
	).run({
		input: {
			locations: [
				{
					name: "Default Warehouse",
					address: {
						city: "Paris",
						country_code: "FR",
						address_1: "",
					},
				},
			],
		},
	});
	const stockLocation = stockLocationResult[0];

	await updateStoresWorkflow(container).run({
		input: {
			selector: { id: store.id },
			update: {
				default_location_id: stockLocation.id,
			},
		},
	});

	await link.create({
		[Modules.STOCK_LOCATION]: {
			stock_location_id: stockLocation.id,
		},
		[Modules.FULFILLMENT]: {
			fulfillment_provider_id: "manual_manual",
		},
	});

	// Create shipping profile and fulfillment
	logger.info("Creating fulfillment configuration...");
	const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
		type: "default",
	});
	let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null;

	if (!shippingProfile) {
		const { result: shippingProfileResult } =
			await createShippingProfilesWorkflow(container).run({
				input: {
					data: [
						{
							name: "Default Shipping Profile",
							type: "default",
						},
					],
				},
			});
		shippingProfile = shippingProfileResult[0];
	}

	const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
		name: "Default Fulfillment",
		type: "shipping",
		service_zones: [
			{
				name: "France",
				geo_zones: countries.map((country_code) => ({
					country_code,
					type: "country" as const,
				})),
			},
		],
	});

	await link.create({
		[Modules.STOCK_LOCATION]: {
			stock_location_id: stockLocation.id,
		},
		[Modules.FULFILLMENT]: {
			fulfillment_set_id: fulfillmentSet.id,
		},
	});

	// Create shipping options
	await createShippingOptionsWorkflow(container).run({
		input: [
			{
				name: "Standard Shipping",
				price_type: "flat",
				provider_id: "manual_manual",
				service_zone_id: fulfillmentSet.service_zones[0].id,
				shipping_profile_id: shippingProfile.id,
				type: {
					label: "Standard",
					description: "Livraison standard (3-5 jours ouvrés)",
					code: "standard",
				},
				prices: [
					{ currency_code: "eur", amount: 5 },
					{ region_id: region.id, amount: 5 },
				],
				rules: [
					{ attribute: "enabled_in_store", value: "true", operator: "eq" },
					{ attribute: "is_return", value: "false", operator: "eq" },
				],
			},
		],
	});

	await linkSalesChannelsToStockLocationWorkflow(container).run({
		input: {
			id: stockLocation.id,
			add: [defaultSalesChannel[0].id],
		},
	});

	// Create publishable API key
	logger.info("Creating API key...");
	let publishableApiKey: ApiKey | null = null;
	const { data } = await query.graph({
		entity: "api_key",
		fields: ["id"],
		filters: {
			type: "publishable",
		},
	});

	publishableApiKey = data?.[0];

	if (!publishableApiKey) {
		const {
			result: [publishableApiKeyResult],
		} = await createApiKeysWorkflow(container).run({
			input: {
				api_keys: [
					{
						title: "Storefront",
						type: "publishable",
						created_by: "",
					},
				],
			},
		});

		publishableApiKey = publishableApiKeyResult as ApiKey;
	}

	await linkSalesChannelsToApiKeyWorkflow(container).run({
		input: {
			id: publishableApiKey.id,
			add: [defaultSalesChannel[0].id],
		},
	});

	logger.info("Store configuration completed successfully!");
}
