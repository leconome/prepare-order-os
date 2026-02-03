import { defineRouteConfig } from "@medusajs/admin-sdk";
import { Minus, Plus, ShoppingCart, Trash } from "@medusajs/icons";
import {
	Badge,
	Button,
	Container,
	Heading,
	IconButton,
	Input,
	Label,
	Select,
	Text,
	Textarea,
	toast,
} from "@medusajs/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sdk } from "../../../../lib/client";

type Product = {
	id: string;
	title: string;
	variants: Array<{
		id: string;
		title: string;
		prices: Array<{
			amount: number;
			currency_code: string;
		}>;
	}>;
};

type Employee = {
	id: string;
	first_name: string;
	last_name: string;
	role: string;
	is_active: boolean;
};

type Region = {
	id: string;
	name: string;
	currency_code: string;
};

type SalesChannel = {
	id: string;
	name: string;
};

type CartItem = {
	variant_id: string;
	product_title: string;
	variant_title: string;
	quantity: number;
	unit_price: number;
	currency_code: string;
};

const NewPosOrderPage = () => {
	const navigate = useNavigate();
	const [cartItems, setCartItems] = useState<CartItem[]>([]);
	const [selectedRegion, setSelectedRegion] = useState<string>("");
	const [selectedSalesChannel, setSelectedSalesChannel] = useState<string>("");
	const [selectedEmployee, setSelectedEmployee] = useState<string>("");
	const [assignedEmployee, setAssignedEmployee] = useState<string>("");
	const [pickupDate, setPickupDate] = useState<string>("");
	const [pickupTimeStart, setPickupTimeStart] = useState<string>("");
	const [pickupTimeEnd, setPickupTimeEnd] = useState<string>("");
	const [clientNote, setClientNote] = useState<string>("");
	const [internalNote, setInternalNote] = useState<string>("");
	const [productSearch, setProductSearch] = useState<string>("");

	// Fetch regions
	const { data: regionsData } = useQuery({
		queryFn: async () => {
			const response = await sdk.admin.region.list({ limit: 100 });
			return response.regions;
		},
		queryKey: ["regions"],
	});

	// Fetch sales channels
	const { data: salesChannelsData } = useQuery({
		queryFn: async () => {
			const response = await sdk.admin.salesChannel.list({ limit: 100 });
			return response.sales_channels;
		},
		queryKey: ["sales-channels"],
	});

	// Fetch employees
	const { data: employeesData } = useQuery({
		queryFn: async () => {
			const response = await sdk.client.fetch<{
				employees: Employee[];
			}>("/admin/pos/employees");
			return response.employees.filter((e) => e.is_active);
		},
		queryKey: ["pos-employees-active"],
	});

	// Fetch products
	const { data: productsData } = useQuery({
		queryFn: async () => {
			const response = await sdk.admin.product.list({
				limit: 100,
				q: productSearch || undefined,
				fields: "id,title,variants.id,variants.title,variants.prices.*",
			});
			return response.products as Product[];
		},
		queryKey: ["products", productSearch],
	});

	// Create POS draft order mutation
	const createPosOrder = useMutation({
		mutationFn: async () => {
			const region = regionsData?.find((r) => r.id === selectedRegion);
			if (!region) throw new Error("Région non sélectionnée");

			const response = await sdk.client.fetch<{
				order: { id: string };
				pos_order: { id: string; ticket_number: string };
			}>("/admin/pos/draft-orders", {
				method: "POST",
				body: {
					region_id: selectedRegion,
					sales_channel_id: selectedSalesChannel,
					currency_code: region.currency_code,
					email: "pos@store.local",
					items: cartItems.map((item) => ({
						variant_id: item.variant_id,
						quantity: item.quantity,
						unit_price: item.unit_price,
					})),
					created_by_id: selectedEmployee,
					assigned_to_id:
						assignedEmployee && assignedEmployee !== "_none"
							? assignedEmployee
							: undefined,
					pickup_date: pickupDate || undefined,
					pickup_time_start: pickupTimeStart || undefined,
					pickup_time_end: pickupTimeEnd || undefined,
					client_note: clientNote || undefined,
					internal_note: internalNote || undefined,
				},
			});
			return response;
		},
		onSuccess: (data) => {
			toast.success(`Commande créée: ${data.pos_order.ticket_number}`);
			navigate(`/orders/${data.order.id}`);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Erreur lors de la création");
		},
	});

	const addToCart = (product: Product, variantId: string) => {
		const variant = product.variants.find((v) => v.id === variantId);
		if (!variant) return;

		const region = regionsData?.find((r) => r.id === selectedRegion);
		const price = variant.prices?.find(
			(p) => p.currency_code === region?.currency_code,
		);

		const existingItem = cartItems.find(
			(item) => item.variant_id === variantId,
		);
		if (existingItem) {
			setCartItems(
				cartItems.map((item) =>
					item.variant_id === variantId
						? { ...item, quantity: item.quantity + 1 }
						: item,
				),
			);
		} else {
			setCartItems([
				...cartItems,
				{
					variant_id: variantId,
					product_title: product.title,
					variant_title: variant.title,
					quantity: 1,
					unit_price: price?.amount || 0,
					currency_code: region?.currency_code || "eur",
				},
			]);
		}
	};

	const updateQuantity = (variantId: string, delta: number) => {
		setCartItems(
			cartItems
				.map((item) =>
					item.variant_id === variantId
						? { ...item, quantity: Math.max(0, item.quantity + delta) }
						: item,
				)
				.filter((item) => item.quantity > 0),
		);
	};

	const removeFromCart = (variantId: string) => {
		setCartItems(cartItems.filter((item) => item.variant_id !== variantId));
	};

	const calculateTotal = () => {
		return cartItems.reduce(
			(sum, item) => sum + item.unit_price * item.quantity,
			0,
		);
	};

	const formatPrice = (amount: number, currencyCode: string) => {
		return new Intl.NumberFormat("fr-FR", {
			style: "currency",
			currency: currencyCode,
		}).format(amount / 100);
	};

	const canSubmit =
		selectedRegion &&
		selectedSalesChannel &&
		selectedEmployee &&
		cartItems.length > 0;

	return (
		<div className="flex gap-4 p-6">
			{/* Left panel - Products */}
			<div className="flex-1">
				<Container className="divide-y p-0">
					<div className="flex items-center justify-between px-6 py-4">
						<Heading level="h1">Nouvelle commande POS</Heading>
					</div>

					{/* Configuration */}
					<div className="px-6 py-4">
						<div className="grid grid-cols-3 gap-4 mb-4">
							<div className="flex flex-col gap-y-2">
								<Label>Région *</Label>
								<Select
									value={selectedRegion}
									onValueChange={setSelectedRegion}
								>
									<Select.Trigger>
										<Select.Value placeholder="Sélectionner" />
									</Select.Trigger>
									<Select.Content>
										{regionsData?.map((region) => (
											<Select.Item key={region.id} value={region.id}>
												{region.name}
											</Select.Item>
										))}
									</Select.Content>
								</Select>
							</div>

							<div className="flex flex-col gap-y-2">
								<Label>Canal de vente *</Label>
								<Select
									value={selectedSalesChannel}
									onValueChange={setSelectedSalesChannel}
								>
									<Select.Trigger>
										<Select.Value placeholder="Sélectionner" />
									</Select.Trigger>
									<Select.Content>
										{salesChannelsData?.map((channel) => (
											<Select.Item key={channel.id} value={channel.id}>
												{channel.name}
											</Select.Item>
										))}
									</Select.Content>
								</Select>
							</div>

							<div className="flex flex-col gap-y-2">
								<Label>Créé par *</Label>
								<Select
									value={selectedEmployee}
									onValueChange={setSelectedEmployee}
								>
									<Select.Trigger>
										<Select.Value placeholder="Sélectionner" />
									</Select.Trigger>
									<Select.Content>
										{employeesData?.map((employee) => (
											<Select.Item key={employee.id} value={employee.id}>
												{employee.first_name} {employee.last_name}
											</Select.Item>
										))}
									</Select.Content>
								</Select>
							</div>
						</div>
					</div>

					{/* Product search */}
					<div className="px-6 py-4">
						<Label className="mb-2">Rechercher un produit</Label>
						<Input
							value={productSearch}
							onChange={(e) => setProductSearch(e.target.value)}
							placeholder="Nom du produit..."
						/>
					</div>

					{/* Products list */}
					<div className="px-6 py-4 max-h-[400px] overflow-auto">
						{!selectedRegion ? (
							<Text className="text-ui-fg-subtle">
								Sélectionnez une région pour voir les produits
							</Text>
						) : (
							<div className="flex flex-col gap-2">
								{productsData?.map((product) => (
									<div
										key={product.id}
										className="border border-ui-border-base rounded-lg p-3"
									>
										<Text size="small" weight="plus" className="mb-2">
											{product.title}
										</Text>
										<div className="flex flex-wrap gap-2">
											{product.variants.map((variant) => {
												const region = regionsData?.find(
													(r) => r.id === selectedRegion,
												);
												const price = variant.prices?.find(
													(p) => p.currency_code === region?.currency_code,
												);
												return (
													<Button
														key={variant.id}
														size="small"
														variant="secondary"
														onClick={() => addToCart(product, variant.id)}
													>
														{variant.title || "Par défaut"}
														{price && (
															<span className="ml-2 text-ui-fg-subtle">
																{formatPrice(price.amount, price.currency_code)}
															</span>
														)}
													</Button>
												);
											})}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				</Container>
			</div>

			{/* Right panel - Cart */}
			<div className="w-96">
				<Container className="divide-y p-0 sticky top-4">
					<div className="flex items-center gap-x-2 px-6 py-4">
						<ShoppingCart />
						<Heading level="h2">Panier</Heading>
						<Badge>{cartItems.length}</Badge>
					</div>

					{/* Cart items */}
					<div className="px-6 py-4 max-h-[300px] overflow-auto">
						{cartItems.length === 0 ? (
							<Text className="text-ui-fg-subtle">Panier vide</Text>
						) : (
							<div className="flex flex-col gap-3">
								{cartItems.map((item) => (
									<div
										key={item.variant_id}
										className="flex items-center justify-between"
									>
										<div className="flex-1">
											<Text size="small" weight="plus">
												{item.product_title}
											</Text>
											<Text size="xsmall" className="text-ui-fg-subtle">
												{item.variant_title}
											</Text>
										</div>
										<div className="flex items-center gap-2">
											<IconButton
												size="small"
												variant="transparent"
												onClick={() => updateQuantity(item.variant_id, -1)}
											>
												<Minus />
											</IconButton>
											<Text size="small">{item.quantity}</Text>
											<IconButton
												size="small"
												variant="transparent"
												onClick={() => updateQuantity(item.variant_id, 1)}
											>
												<Plus />
											</IconButton>
											<IconButton
												size="small"
												variant="transparent"
												onClick={() => removeFromCart(item.variant_id)}
											>
												<Trash />
											</IconButton>
										</div>
										<Text size="small" className="w-20 text-right">
											{formatPrice(
												item.unit_price * item.quantity,
												item.currency_code,
											)}
										</Text>
									</div>
								))}
							</div>
						)}
					</div>

					{/* Total */}
					<div className="px-6 py-4">
						<div className="flex justify-between">
							<Text weight="plus">Total</Text>
							<Text weight="plus">
								{formatPrice(
									calculateTotal(),
									regionsData?.find((r) => r.id === selectedRegion)
										?.currency_code || "eur",
								)}
							</Text>
						</div>
					</div>

					{/* Pickup info */}
					<div className="px-6 py-4">
						<div className="flex flex-col gap-y-3">
							<div className="flex flex-col gap-y-2">
								<Label>Assigné à</Label>
								<Select
									value={assignedEmployee}
									onValueChange={setAssignedEmployee}
								>
									<Select.Trigger>
										<Select.Value placeholder="Non assigné" />
									</Select.Trigger>
									<Select.Content>
										<Select.Item value="_none">Non assigné</Select.Item>
										{employeesData?.map((employee) => (
											<Select.Item key={employee.id} value={employee.id}>
												{employee.first_name} {employee.last_name}
											</Select.Item>
										))}
									</Select.Content>
								</Select>
							</div>

							<div className="flex flex-col gap-y-2">
								<Label>Date récupération</Label>
								<Input
									type="date"
									value={pickupDate}
									onChange={(e) => setPickupDate(e.target.value)}
								/>
							</div>

							<div className="grid grid-cols-2 gap-2">
								<div className="flex flex-col gap-y-2">
									<Label>Heure début</Label>
									<Input
										type="time"
										value={pickupTimeStart}
										onChange={(e) => setPickupTimeStart(e.target.value)}
									/>
								</div>
								<div className="flex flex-col gap-y-2">
									<Label>Heure fin</Label>
									<Input
										type="time"
										value={pickupTimeEnd}
										onChange={(e) => setPickupTimeEnd(e.target.value)}
									/>
								</div>
							</div>

							<div className="flex flex-col gap-y-2">
								<Label>Note client</Label>
								<Textarea
									value={clientNote}
									onChange={(e) => setClientNote(e.target.value)}
									placeholder="Note pour le client"
									rows={2}
								/>
							</div>

							<div className="flex flex-col gap-y-2">
								<Label>Note interne</Label>
								<Textarea
									value={internalNote}
									onChange={(e) => setInternalNote(e.target.value)}
									placeholder="Note interne"
									rows={2}
								/>
							</div>
						</div>
					</div>

					{/* Submit */}
					<div className="px-6 py-4">
						<Button
							className="w-full"
							onClick={() => createPosOrder.mutate()}
							isLoading={createPosOrder.isPending}
							disabled={!canSubmit}
						>
							Créer la commande
						</Button>
					</div>
				</Container>
			</div>
		</div>
	);
};

export const config = defineRouteConfig({
	label: "Nouvelle commande",
});

export default NewPosOrderPage;
