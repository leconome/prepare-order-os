"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChefHat,
  Clock,
  PackageCheck,
  Rocket,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrders, fetchProducts, type OrderWithItems } from "@/lib/api";

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
      if (!item.isPrepared) unpreparedItems += item.quantity;
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
      productCounts[key].qty += item.quantity;
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

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
  iconColor,
  iconBg,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  loading?: boolean;
  iconColor?: string;
  iconBg?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${iconBg || "bg-muted"}`}>
          <Icon className={`h-4 w-4 ${iconColor || "text-muted-foreground"}`} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TrackerCard({
  title,
  icon: Icon,
  current,
  total,
  label,
  loading,
  color,
  iconColor,
  iconBg,
}: {
  title: string;
  icon: React.ElementType;
  current: number;
  total: number;
  label: string;
  loading?: boolean;
  color?: string;
  iconColor?: string;
  iconBg?: string;
}) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`rounded-lg p-2 ${iconBg || "bg-muted"}`}>
          <Icon className={`h-4 w-4 ${iconColor || "text-muted-foreground"}`} />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-2 w-full" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">{current}</span>
              <span className="text-lg text-muted-foreground">/ {total}</span>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>{label}</span>
                <span className="font-medium">{Math.round(pct)}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color || "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
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
    queryFn: () => fetchOrders({ limit: 200, fromDate: today.from, toDate: today.to }),
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
  const toPrepare = stats.pending + stats.inPreparation;
  const readyTotal = stats.ready + stats.pickedUp;

  return (
    <DashboardLayout
      title="Dashboard"
      description="Vue d'ensemble de votre journée"
    >
      <div className="space-y-6">
        {/* Row 1 — Key metrics */}
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Commandes du jour"
            value={orders.length.toString()}
            icon={ShoppingCart}
            description={`${toPrepare} en cours · ${stats.ready} prête${stats.ready > 1 ? "s" : ""} · ${stats.pickedUp} retirée${stats.pickedUp > 1 ? "s" : ""}`}
            loading={isLoading}
            iconColor="text-blue-600 dark:text-blue-400"
            iconBg="bg-blue-500/10"
          />
          <StatCard
            title="Articles à préparer"
            value={stats.unpreparedItems.toString()}
            icon={ChefHat}
            description="Items non préparés"
            loading={isLoading}
            iconColor="text-amber-600 dark:text-amber-400"
            iconBg="bg-amber-500/10"
          />
        </div>

        {/* Row 2 — Tracker cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <TrackerCard
            title="À préparer"
            icon={Clock}
            current={toPrepare}
            total={orders.length}
            label={`${stats.pending} en attente · ${stats.inPreparation} en cours`}
            loading={isLoading}
            color="bg-amber-500"
            iconColor="text-amber-600 dark:text-amber-400"
            iconBg="bg-amber-500/10"
          />
          <TrackerCard
            title="Retraits"
            icon={PackageCheck}
            current={stats.pickedUp}
            total={readyTotal}
            label={readyTotal > 0 ? `${stats.ready} en attente de retrait` : "Aucune commande prête"}
            loading={isLoading}
            color="bg-emerald-500"
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-500/10"
          />
          <TrackerCard
            title="Paiements"
            icon={Wallet}
            current={stats.paid}
            total={orders.length}
            label={stats.unpaid > 0 ? `${stats.unpaid} impayée${stats.unpaid > 1 ? "s" : ""}` : "Tout est réglé"}
            loading={isLoading}
            color="bg-blue-500"
            iconColor="text-blue-600 dark:text-blue-400"
            iconBg="bg-blue-500/10"
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
                          p.stock === 0
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      >
                        {p.stock === 0 ? "Rupture" : `${p.stock} restant${(p.stock ?? 0) > 1 ? "s" : ""}`}
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
