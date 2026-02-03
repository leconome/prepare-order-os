import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Plus } from "@medusajs/icons";
import { Badge, Button, Container, Heading, Table, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { sdk } from "../lib/client";

type PosOrder = {
	id: string;
	ticket_number: string;
	payment_status: "pending" | "paid" | "partially_paid" | "refunded";
	preparation_status: "pending" | "in_preparation" | "ready" | "picked_up";
	pickup_date: string | null;
	pickup_time_start: string | null;
	pickup_time_end: string | null;
	order_id: string;
	created_by: {
		id: string;
		first_name: string;
		last_name: string;
	} | null;
	assigned_to: {
		id: string;
		first_name: string;
		last_name: string;
	} | null;
	created_at: string;
};

const PAYMENT_STATUS_LABELS = {
	pending: "En attente",
	paid: "Payé",
	partially_paid: "Partiel",
	refunded: "Remboursé",
};

const PAYMENT_STATUS_COLORS = {
	pending: "orange" as const,
	paid: "green" as const,
	partially_paid: "blue" as const,
	refunded: "red" as const,
};

const PREPARATION_STATUS_LABELS = {
	pending: "En attente",
	in_preparation: "En préparation",
	ready: "Prêt",
	picked_up: "Récupéré",
};

const PREPARATION_STATUS_COLORS = {
	pending: "grey" as const,
	in_preparation: "orange" as const,
	ready: "green" as const,
	picked_up: "blue" as const,
};

const PosOrderListWidget = () => {
	// Fetch recent POS orders
	const { data, isLoading, error } = useQuery({
		queryFn: async () => {
			const response = await sdk.client.fetch<{
				pos_orders: PosOrder[];
				count: number;
			}>("/admin/pos/orders?limit=10");
			return response;
		},
		queryKey: ["pos-orders-list"],
	});

	const formatPickupTime = (order: PosOrder) => {
		if (!order.pickup_date) return "-";
		const date = new Date(order.pickup_date).toLocaleDateString("fr-FR");
		const timeRange =
			order.pickup_time_start && order.pickup_time_end
				? `${order.pickup_time_start}-${order.pickup_time_end}`
				: order.pickup_time_start || "";
		return timeRange ? `${date} ${timeRange}` : date;
	};

	if (error) {
		return null; // Don't show widget if there's an error (module might not be migrated yet)
	}

	return (
		<Container className="divide-y p-0">
			<div className="flex items-center justify-between px-6 py-4">
				<Heading level="h2">Commandes POS</Heading>
				<div className="flex gap-x-2">
					<Button asChild size="small" variant="secondary">
						<Link to="/pos/employees">Gérer employés</Link>
					</Button>
					<Button asChild size="small">
						<Link to="/pos/orders/new">
							<Plus />
							Nouvelle
						</Link>
					</Button>
				</div>
			</div>

			<div className="px-6 py-4">
				{isLoading ? (
					<div className="flex items-center justify-center py-8">
						<Text className="text-ui-fg-subtle">Chargement...</Text>
					</div>
				) : !data?.pos_orders?.length ? (
					<Text className="text-ui-fg-subtle">
						Aucune commande POS pour le moment
					</Text>
				) : (
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.HeaderCell>Ticket</Table.HeaderCell>
								<Table.HeaderCell>Paiement</Table.HeaderCell>
								<Table.HeaderCell>Préparation</Table.HeaderCell>
								<Table.HeaderCell>Récupération</Table.HeaderCell>
								<Table.HeaderCell>Créé par</Table.HeaderCell>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{data.pos_orders.map((order) => (
								<Table.Row key={order.id}>
									<Table.Cell>
										<Link
											to={`/orders/${order.order_id}`}
											className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
										>
											<Text size="small" weight="plus" className="font-mono">
												{order.ticket_number}
											</Text>
										</Link>
									</Table.Cell>
									<Table.Cell>
										<Badge color={PAYMENT_STATUS_COLORS[order.payment_status]}>
											{PAYMENT_STATUS_LABELS[order.payment_status]}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<Badge
											color={
												PREPARATION_STATUS_COLORS[order.preparation_status]
											}
										>
											{PREPARATION_STATUS_LABELS[order.preparation_status]}
										</Badge>
									</Table.Cell>
									<Table.Cell>
										<Text size="small" className="text-ui-fg-subtle">
											{formatPickupTime(order)}
										</Text>
									</Table.Cell>
									<Table.Cell>
										<Text size="small" className="text-ui-fg-subtle">
											{order.created_by
												? `${order.created_by.first_name} ${order.created_by.last_name}`
												: "-"}
										</Text>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				)}
			</div>
		</Container>
	);
};

export const config = defineWidgetConfig({
	zone: "order.list.before",
});

export default PosOrderListWidget;
