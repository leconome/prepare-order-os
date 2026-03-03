"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChefHat,
  PackageCheck,
  Rocket,
} from "lucide-react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { parseQty, formatQtyLabel } from "@prepareos/data";
import { fetchOrders, fetchProducts, formatCurrency, type OrderWithItems } from "@/lib/api";

// ============ HELPERS ============

function getToday() {
  return {
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  };
}

function computeDashboardStats(orders: OrderWithItems[]) {
  const pending = orders.filter((o) => o.preparationStatus === "pending").length;
  const inPreparation = orders.filter((o) => o.preparationStatus === "in_preparation").length;
  const ready = orders.filter((o) => o.preparationStatus === "ready").length;
  const pickedUp = orders.filter((o) => o.preparationStatus === "picked_up").length;

  const paid = orders.filter((o) => o.paymentStatus === "paid").length;
  const unpaid = orders.filter((o) => o.paymentStatus === "pending" || o.paymentStatus === "partially_paid").length;

  // Count unprepared items
  let unpreparedItems = 0;
  for (const order of orders) {
    if (order.preparationStatus === "picked_up") continue;
    for (const item of order.items || []) {
      if (!item.isPrepared) unpreparedItems += parseQty(item.quantity);
    }
  }

  // Top products
  const productCounts: Record<string, { name: string; qty: number }> = {};
  for (const order of orders) {
    for (const item of order.items || []) {
      const key = item.productId;
      if (!productCounts[key]) {
        productCounts[key] = { name: item.productName, qty: 0 };
      }
      productCounts[key].qty += parseQty(item.quantity);
    }
  }
  const topProducts = Object.values(productCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    pending,
    inPreparation,
    ready,
    pickedUp,
    paid,
    unpaid,
    unpreparedItems,
    topProducts,
  };
}

// ============ COMPONENTS ============

function OrderTable({
  title,
  icon: Icon,
  orders,
  total,
  loading,
  emptyMessage,
  iconColor,
  strikeStatuses,
}: {
  title: string;
  icon: React.ElementType;
  orders: OrderWithItems[];
  total: number;
  loading?: boolean;
  emptyMessage: string;
  iconColor?: string;
  strikeStatuses?: string[];
}) {
  const router = useRouter();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor || "text-muted-foreground"}`} />
          {title}
        </CardTitle>
        <span className="text-sm font-semibold text-muted-foreground">
          {orders.length}/{total}
        </span>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {emptyMessage}
          </p>
        ) : (
          <div className="space-y-1.5">
            {orders.map((order) => {
              const pickupTime =
                order.pickupTimeStart && order.pickupTimeEnd
                  ? `${order.pickupTimeStart}–${order.pickupTimeEnd}`
                  : order.pickupTimeStart || null;

              const itemsSummary = (order.items ?? [])
                .slice(0, 3)
                .map((item) => {
                  const label = formatQtyLabel(item.quantity, item.unit);
                  return label !== "1x" ? `${label} ${item.productName}` : item.productName;
                })
                .join(", ");

              const remaining = (order.items?.length ?? 0) - 3;
              const isStruck = strikeStatuses?.includes(order.preparationStatus);

              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => router.push(`/preparation/${order.id}`)}
                  className={`flex items-center gap-3 w-full rounded-md border px-3 py-2 text-left text-sm transition-colors cursor-pointer ${isStruck ? "opacity-50 line-through" : "hover:bg-muted/50"}`}
                >
                  <span className="font-mono font-bold shrink-0">
                    #{order.ticketNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {order.client?.name ?? "---"}
                      </span>
                      {pickupTime && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {pickupTime}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {itemsSummary}{remaining > 0 ? ` +${remaining}` : ""}
                    </div>
                  </div>
                  <span className="font-medium shrink-0">
                    {formatCurrency(order.total)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MAIN PAGE ============

export default function DashboardPage() {
  const today = getToday();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: () => fetchOrders({ limit: 200, pickupDateFrom: today.from, pickupDateTo: today.to }),
    refetchInterval: 30_000,
  });

  const { data: lowStockData, isLoading: isLoadingStock } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: () => fetchProducts({ limit: 20, maxStock: 5, isActive: true }),
    refetchInterval: 60_000,
  });

  const lowStockProducts = lowStockData?.data ?? [];
  const orders = data?.data ?? [];
  const stats = computeDashboardStats(orders);
  return (
    <DashboardLayout
      title="Dashboard"
      description="Vue d'ensemble de votre journée"
    >
      <div className="space-y-6">
        {/* Order tables: À préparer + À récupérer */}
        <div className="grid gap-4 md:grid-cols-2">
          <OrderTable
            title="À préparer"
            icon={ChefHat}
            orders={orders.filter((o) => o.preparationStatus === "pending" || o.preparationStatus === "in_preparation")}
            total={orders.length}
            loading={isLoading}
            emptyMessage="Aucune commande à préparer"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <OrderTable
            title="À récupérer"
            icon={PackageCheck}
            orders={orders.filter((o) => o.preparationStatus === "ready" || o.preparationStatus === "picked_up")}
            total={orders.length}
            loading={isLoading}
            emptyMessage="Aucune commande prête"
            iconColor="text-emerald-600 dark:text-emerald-400"
            strikeStatuses={["picked_up"]}
          />
        </div>

        {/* Row 3 — Low stock alert */}
        {lowStockProducts.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Stock faible
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {lowStockProducts.length} produit{lowStockProducts.length > 1 ? "s" : ""}
              </span>
            </CardHeader>
            <CardContent>
              {isLoadingStock ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {lowStockProducts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate">{p.name}</span>
                      <span
                        className={`ml-2 font-semibold whitespace-nowrap ${
                          parseQty(p.stock ?? 0) === 0
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      >
                        {parseQty(p.stock ?? 0) === 0 ? "Rupture" : `${parseQty(p.stock ?? 0)} restant${parseQty(p.stock ?? 0) > 1 ? "s" : ""}`}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Row 4 — Preparation breakdown + Top products */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Preparation breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Répartition préparation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {[
                    { label: "En attente", count: stats.pending, color: "bg-amber-500", icon: "🕐" },
                    { label: "En préparation", count: stats.inPreparation, color: "bg-blue-500", icon: "👨‍🍳" },
                    { label: "Prêt", count: stats.ready, color: "bg-emerald-500", icon: "✅" },
                    { label: "Récupéré", count: stats.pickedUp, color: "bg-gray-400", icon: "📦" },
                  ].map((item) => {
                    const pct = orders.length > 0 ? (item.count / orders.length) * 100 : 0;
                    return (
                      <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <span>{item.icon}</span>
                            <span>{item.label}</span>
                          </span>
                          <span className="font-semibold">{item.count}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top products */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">
                Top produits du jour
              </CardTitle>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : stats.topProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune commande aujourd'hui
                </p>
              ) : (
                <div className="space-y-3">
                  {stats.topProducts.map((p, i) => {
                    const maxQty = stats.topProducts[0]?.qty || 1;
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">
                              {i + 1}
                            </span>
                            <span className="truncate">{p.name}</span>
                          </div>
                          <span className="font-semibold whitespace-nowrap ml-2">
                            {p.qty} vendu{p.qty > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                            style={{ width: `${(p.qty / maxQty) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
