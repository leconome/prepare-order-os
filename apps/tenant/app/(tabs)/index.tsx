import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
} from "react-native";

import { Text, View } from "@/components/Themed";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  isMenu: boolean;
};

type Order = {
  id: string;
  ticketNumber: string;
  preparationStatus: "pending" | "in_preparation" | "ready" | "picked_up";
  paymentStatus: "pending" | "paid" | "partially_paid" | "refunded";
  total: string;
  clientNote: string | null;
  pickupTimeStart: string | null;
  pickupTimeEnd: string | null;
  client: { id: string; name: string } | null;
  items: OrderItem[];
  createdAt: string;
};

type OrdersResponse = {
  data: Order[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

const PREP_STATUS_LABELS: Record<Order["preparationStatus"], string> = {
  pending: "En attente",
  in_preparation: "En préparation",
  ready: "Prêt",
  picked_up: "Récupéré",
};

const PREP_STATUS_COLORS: Record<Order["preparationStatus"], string> = {
  pending: "#f59e0b",
  in_preparation: "#3b82f6",
  ready: "#22c55e",
  picked_up: "#6b7280",
};

const PAYMENT_LABELS: Record<Order["paymentStatus"], string> = {
  pending: "Impayé",
  paid: "Payé",
  partially_paid: "Partiel",
  refunded: "Remboursé",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const today = todayISO();
      const res = await api<OrdersResponse>(
        `/api/orders?pickupDate=${today}&limit=200`,
      );
      setOrders(res.data);
      setTotal(res.pagination.total);
    } catch (err: any) {
      setError(err.message || "Impossible de charger les commandes");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchOrders();
  }, [fetchOrders]);

  function renderOrder({ item: order }: { item: Order }) {
    const prepColor = PREP_STATUS_COLORS[order.preparationStatus];
    const itemsSummary = order.items
      .slice(0, 3)
      .map((i) => `${i.quantity}x ${i.productName}`)
      .join(", ");
    const moreCount = order.items.length - 3;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.ticketNumber}>{order.ticketNumber}</Text>
            {order.client ? (
              <Text style={styles.clientName}>{order.client.name}</Text>
            ) : null}
          </View>
          <Text style={styles.totalPrice}>{order.total} €</Text>
        </View>

        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: prepColor }]}>
            <Text style={styles.badgeText}>
              {PREP_STATUS_LABELS[order.preparationStatus]}
            </Text>
          </View>
          <View
            style={[
              styles.badge,
              {
                backgroundColor:
                  order.paymentStatus === "paid" ? "#166534" : "#92400e",
              },
            ]}
          >
            <Text style={styles.badgeText}>
              {PAYMENT_LABELS[order.paymentStatus]}
            </Text>
          </View>
          {order.pickupTimeStart ? (
            <View style={[styles.badge, { backgroundColor: "#374151" }]}>
              <Text style={styles.badgeText}>
                {order.pickupTimeStart}
                {order.pickupTimeEnd ? `–${order.pickupTimeEnd}` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.itemsSummary} numberOfLines={2}>
          {itemsSummary}
          {moreCount > 0 ? ` +${moreCount}` : ""}
        </Text>

        {order.clientNote ? (
          <Text style={styles.note} numberOfLines={1}>
            {order.clientNote}
          </Text>
        ) : null}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>
        Bonjour, {user?.name || "Commerçant"}
      </Text>
      <Text style={styles.title}>
        Commandes du jour{" "}
        <Text style={styles.count}>({total})</Text>
      </Text>

      {error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Aucune commande aujourd'hui</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={renderOrder}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#888"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  greeting: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
  },
  count: {
    fontSize: 22,
    fontWeight: "normal",
    opacity: 0.5,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#1a1a1a",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    backgroundColor: "transparent",
  },
  cardHeaderLeft: {
    flex: 1,
    backgroundColor: "transparent",
  },
  ticketNumber: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  clientName: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
    backgroundColor: "transparent",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  itemsSummary: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  note: {
    fontSize: 12,
    opacity: 0.5,
    fontStyle: "italic",
    marginTop: 6,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.5,
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
  },
});
