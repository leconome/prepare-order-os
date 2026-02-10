"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  UserRound,
} from "lucide-react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchClients,
  fetchOrders,
  fetchProducts,
  formatCurrency,
  type OrderWithItems,
} from "@/lib/api";
import { PAYMENT_LABELS } from "@/lib/constants";

// ============ STAT CARD ============

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============ HELPERS ============

function getToday() {
  const now = new Date();
  return {
    from: new Date(now.setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  };
}

function computeStats(orders: OrderWithItems[]) {
  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;

  const byPreparation: Record<string, number> = {};
  const byPayment: Record<string, number> = {};
  const productCounts: Record<
    string,
    { name: string; qty: number; revenue: number }
  > = {};

  for (const order of orders) {
    byPreparation[order.preparationStatus] =
      (byPreparation[order.preparationStatus] || 0) + 1;
    byPayment[order.paymentStatus] = (byPayment[order.paymentStatus] || 0) + 1;

    for (const item of order.items || []) {
      const key = item.productId;
      if (!productCounts[key]) {
        productCounts[key] = { name: item.productName, qty: 0, revenue: 0 };
      }
      productCounts[key].qty += item.quantity;
      productCounts[key].revenue += parseFloat(item.totalPrice);
    }
  }

  const topProducts = Object.values(productCounts)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  return { totalRevenue, avgOrder, byPreparation, byPayment, topProducts };
}

// ============ BREAKDOWN CARD ============

const PREPARATION_LABELS: Record<string, string> = {
  pending: "En attente",
  in_preparation: "En préparation",
  ready: "Prêt",
  picked_up: "Récupéré",
};

const PREPARATION_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  in_preparation: "bg-blue-500",
  ready: "bg-green-500",
  picked_up: "bg-gray-400",
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: "bg-red-500",
  paid: "bg-green-500",
  partially_paid: "bg-amber-500",
  refunded: "bg-gray-400",
};

function BreakdownCard({
  title,
  data,
  labels,
  colors,
  total,
  loading,
}: {
  title: string;
  data: Record<string, number>;
  labels: Record<string, string>;
  colors: Record<string, string>;
  total: number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(labels).map(([key, label]) => {
              const count = data[key] || 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{label}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${colors[key] || "bg-gray-400"}`}
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
  );
}

// ============ MAIN PAGE ============

export default function StatsPage() {
  const today = getToday();

  const { data: todayData, isLoading: loadingToday } = useQuery({
    queryKey: ["stats-today"],
    queryFn: () =>
      fetchOrders({ limit: 100, fromDate: today.from, toDate: today.to }),
  });

  const { data: allData, isLoading: loadingAll } = useQuery({
    queryKey: ["stats-all"],
    queryFn: () => fetchOrders({ limit: 100 }),
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["stats-products"],
    queryFn: () => fetchProducts({ limit: 1 }),
  });

  const { data: clientsData, isLoading: loadingClients } = useQuery({
    queryKey: ["stats-clients"],
    queryFn: () => fetchClients({ limit: 1 }),
  });

  const todayOrders = todayData?.data ?? [];
  const allOrders = allData?.data ?? [];
  const todayStats = computeStats(todayOrders);
  const allStats = computeStats(allOrders);

  const isLoading = loadingToday || loadingAll;

  return (
    <DashboardLayout
      title="Statistiques"
      description="Vue d'ensemble de votre activité"
    >
      <div className="space-y-6">
        {/* Today's summary */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Aujourd'hui
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Commandes du jour"
              value={todayOrders.length.toString()}
              icon={ShoppingCart}
              loading={loadingToday}
            />
            <StatCard
              title="CA du jour"
              value={formatCurrency(todayStats.totalRevenue)}
              icon={DollarSign}
              loading={loadingToday}
            />
            <StatCard
              title="Panier moyen"
              value={formatCurrency(todayStats.avgOrder)}
              icon={TrendingUp}
              loading={loadingToday}
            />
            <StatCard
              title="En attente"
              value={(
                (todayStats.byPreparation["pending"] || 0) +
                (todayStats.byPreparation["in_preparation"] || 0)
              ).toString()}
              icon={Package}
              description="À préparer / en cours"
              loading={loadingToday}
            />
          </div>
        </div>

        {/* Global summary */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Global
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total commandes"
              value={(allData?.pagination?.total ?? 0).toString()}
              icon={ShoppingCart}
              loading={loadingAll}
            />
            <StatCard
              title="CA total"
              value={formatCurrency(allStats.totalRevenue)}
              icon={DollarSign}
              description="Sur les commandes récentes"
              loading={loadingAll}
            />
            <StatCard
              title="Produits"
              value={(productsData?.pagination?.total ?? 0).toString()}
              icon={Package}
              loading={loadingProducts}
            />
            <StatCard
              title="Clients"
              value={(clientsData?.pagination?.total ?? 0).toString()}
              icon={UserRound}
              loading={loadingClients}
            />
          </div>
        </div>

        {/* Breakdowns */}
        <div className="grid gap-4 md:grid-cols-2">
          <BreakdownCard
            title="Statut de préparation (aujourd'hui)"
            data={todayStats.byPreparation}
            labels={PREPARATION_LABELS}
            colors={PREPARATION_COLORS}
            total={todayOrders.length}
            loading={loadingToday}
          />
          <BreakdownCard
            title="Statut de paiement (aujourd'hui)"
            data={todayStats.byPayment}
            labels={PAYMENT_LABELS}
            colors={PAYMENT_COLORS}
            total={todayOrders.length}
            loading={loadingToday}
          />
        </div>

        {/* Top products */}
        {todayStats.topProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Top produits du jour
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingToday ? (
                <div className="space-y-2">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : (
                <div className="space-y-2">
                  {todayStats.topProducts.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-5 text-right">
                          {i + 1}.
                        </span>
                        <span>{p.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          {p.qty} vendu{p.qty > 1 ? "s" : ""}
                        </span>
                        <span className="font-medium">
                          {formatCurrency(p.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
