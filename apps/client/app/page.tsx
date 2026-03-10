"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  DollarSign,
  Flame,
  PackageCheck,
  ShoppingBag,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { parseQty } from "@prepareos/data";
import {
  fetchOrders,
  fetchProducts,
  formatCurrency,
  type OrderWithItems,
} from "@/lib/api";

function getToday() {
  return {
    from: new Date(new Date().setHours(0, 0, 0, 0)),
    to: new Date(new Date().setHours(23, 59, 59, 999)),
  };
}

function getMotivationMessage(progress: number, toPrepare: number) {
  if (toPrepare === 0) return "Tout est prêt, bravo !";
  if (progress >= 80) return "Dernière ligne droite !";
  if (progress >= 50) return "Plus de la moitié, on lâche rien !";
  if (progress >= 20) return "Bien lancé, on continue !";
  return "C'est parti, bonne journée !";
}

function computeStats(orders: OrderWithItems[]) {
  const toPrepare = orders.filter(
    (o) => o.preparationStatus === "pending" || o.preparationStatus === "in_preparation",
  );
  const toPickup = orders.filter((o) => o.preparationStatus === "ready");
  const done = orders.filter((o) => o.preparationStatus === "picked_up");
  const unpaid = orders.filter(
    (o) => o.paymentStatus === "pending" || o.paymentStatus === "partially_paid",
  );

  const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
  const paidRevenue = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);

  let totalItems = 0;
  let preparedItems = 0;
  for (const order of orders) {
    for (const item of order.items || []) {
      const qty = parseQty(item.quantity);
      totalItems += qty;
      if (item.isPrepared) preparedItems += qty;
    }
  }

  const progress = orders.length > 0
    ? Math.round((done.length / orders.length) * 100)
    : 0;

  return {
    toPrepare: toPrepare.length,
    toPickup: toPickup.length,
    done: done.length,
    total: orders.length,
    unpaid: unpaid.length,
    totalRevenue,
    paidRevenue,
    totalItems,
    preparedItems,
    progress,
  };
}

export default function DashboardPage() {
  const today = getToday();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: () =>
      fetchOrders({ limit: 200, pickupDateFrom: today.from, pickupDateTo: today.to }),
    refetchInterval: 30_000,
  });

  const { data: lowStockData, isLoading: isLoadingStock } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: () => fetchProducts({ limit: 20, maxStock: 5, isActive: true }),
    refetchInterval: 60_000,
  });

  const orders = data?.data ?? [];
  const lowStockProducts = lowStockData?.data ?? [];
  const stats = computeStats(orders);
  const itemProgress = stats.totalItems > 0
    ? Math.round((stats.preparedItems / stats.totalItems) * 100)
    : 0;

  return (
    <DashboardLayout title="Dashboard" description="Vue d'ensemble de votre journée">
      <div className="space-y-6">
        {/* ── Motivation banner ── */}
        <Card className="bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-purple-200 dark:border-purple-800">
          <CardContent className="py-6">
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900">
                      <Flame className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {getMotivationMessage(stats.progress, stats.toPrepare)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {stats.done} récupérée{stats.done !== 1 ? "s" : ""} sur {stats.total} commande{stats.total !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-3xl font-black text-purple-600 dark:text-purple-400">
                    {stats.progress}%
                  </span>
                </div>
                {/* Segmented progress bar */}
                <div className="space-y-2">
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
                    {stats.done > 0 && (
                      <div
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${(stats.done / stats.total) * 100}%` }}
                      />
                    )}
                    {stats.toPickup > 0 && (
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${(stats.toPickup / stats.total) * 100}%` }}
                      />
                    )}
                    {stats.toPrepare > 0 && (
                      <div
                        className="h-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${(stats.toPrepare / stats.total) * 100}%` }}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="text-muted-foreground">{stats.toPrepare} à préparer</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">{stats.toPickup} à récupérer</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">{stats.done} récupérée{stats.done !== 1 ? "s" : ""}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── À préparer + À récupérer ── */}
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/preparation?tab=to_prepare" className="group">
            <Card className="relative overflow-hidden border-amber-200 dark:border-amber-800 transition-all hover:shadow-lg hover:shadow-amber-500/10 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/10" />
              <CardContent className="relative flex items-center gap-4 py-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/50">
                  <ChefHat className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">À préparer</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-black tracking-tight">
                      {stats.toPrepare}
                      <span className="text-base font-normal text-muted-foreground ml-2">
                        commande{stats.toPrepare !== 1 ? "s" : ""}
                      </span>
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-600 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/preparation?tab=ready" className="group">
            <Card className="relative overflow-hidden border-emerald-200 dark:border-emerald-800 transition-all hover:shadow-lg hover:shadow-emerald-500/10 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-green-500/10" />
              <CardContent className="relative flex items-center gap-4 py-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50">
                  <PackageCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">À récupérer</p>
                  {isLoading ? (
                    <Skeleton className="h-9 w-16 mt-1" />
                  ) : (
                    <p className="text-3xl font-black tracking-tight">
                      {stats.toPickup}
                      <span className="text-base font-normal text-muted-foreground ml-2">
                        commande{stats.toPickup !== 1 ? "s" : ""}
                      </span>
                    </p>
                  )}
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ── Stats row ── */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Commandes</p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-10 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">{stats.total}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Articles préparés</p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-16 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">
                      {stats.preparedItems}
                      <span className="text-sm font-normal text-muted-foreground">/{stats.totalItems}</span>
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">CA du jour</p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-20 mt-0.5" />
                  ) : (
                    <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <DollarSign className={`h-4 w-4 ${stats.unpaid > 0 ? "text-amber-500" : "text-green-500"}`} />
                <div>
                  <p className="text-xs text-muted-foreground">Impayées</p>
                  {isLoading ? (
                    <Skeleton className="h-6 w-10 mt-0.5" />
                  ) : (
                    <p className={`text-xl font-bold ${stats.unpaid > 0 ? "text-amber-600" : ""}`}>
                      {stats.unpaid}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Progression articles ── */}
        {!isLoading && stats.totalItems > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-muted-foreground" />
                Progression préparation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {stats.preparedItems} article{stats.preparedItems !== 1 ? "s" : ""} préparé{stats.preparedItems !== 1 ? "s" : ""} sur {stats.totalItems}
                  </span>
                  <span className="font-bold">{itemProgress}%</span>
                </div>
                <Progress value={itemProgress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Ruptures / Stock faible ── */}
        {!isLoadingStock && lowStockProducts.length > 0 && (
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Alertes stock
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {lowStockProducts.length} produit{lowStockProducts.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {lowStockProducts.map((p) => {
                  const stock = parseQty(p.stock ?? 0);
                  const isOut = stock === 0;
                  return (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate">{p.name}</span>
                      <span
                        className={`ml-2 text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-full ${
                          isOut
                            ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                        }`}
                      >
                        {isOut ? "Rupture" : `${stock} restant${stock > 1 ? "s" : ""}`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
