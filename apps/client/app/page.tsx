"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  ChefHat,
  PackageCheck,
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
import { parseQty } from "@prepareos/data";
import {
  fetchOrders,
  fetchProducts,
  fetchTenantSettings,
  type OrderWithItems,
} from "@/lib/api";

function getDateRange(filterDays: number) {
  const now = new Date();
  const to = new Date(now);
  to.setDate(to.getDate() + filterDays);
  to.setHours(23, 59, 59, 999);
  return { to };
}

function getMotivationMessage(progress: number, toPrepare: number) {
  if (toPrepare === 0) return "Tout est prêt, bravo !";
  if (progress >= 80) return "Dernière ligne droite !";
  if (progress >= 50) return "Plus de la moitié, on lâche rien !";
  if (progress >= 20) return "Bien lancé, on continue !";
  return "C'est parti, bonne journée !";
}

function isToday(dateStr: string | Date | null | undefined) {
  if (!dateStr) return false;
  const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function computeStats(orders: OrderWithItems[]) {
  const toPrepare = orders.filter(
    (o) => o.preparationStatus === "pending" || o.preparationStatus === "in_preparation",
  );
  const toPickup = orders.filter((o) => o.preparationStatus === "ready");
  const done = orders.filter((o) => o.preparationStatus === "picked_up" && isToday(o.pickupDate));

  const visibleTotal = toPrepare.length + toPickup.length + done.length;
  const progress = visibleTotal > 0
    ? Math.round((done.length / visibleTotal) * 100)
    : 0;

  return {
    toPrepare: toPrepare.length,
    toPickup: toPickup.length,
    done: done.length,
    total: visibleTotal,
    progress,
  };
}

export default function DashboardPage() {
  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const filterDays = tenant?.preparationFilterDays ?? 0;
  const { to } = getDateRange(filterDays);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-today", filterDays],
    queryFn: () =>
      fetchOrders({ limit: 200, pickupDateTo: to }),
    refetchInterval: 30_000,
  });

  const { data: lowStockData, isLoading: isLoadingStock } = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: () => fetchProducts({ limit: 20, maxStock: 5, isActive: true }),
    refetchInterval: 60_000,
  });

  const allOrders = data?.data ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const orders = allOrders.filter((o) => {
    const pickup = o.pickupDate ? new Date(o.pickupDate) : null;
    if (!pickup) return o.preparationStatus !== "picked_up";
    if (pickup >= todayStart) return true;
    return o.preparationStatus !== "picked_up";
  });

  const lowStockProducts = lowStockData?.data ?? [];
  const stats = computeStats(orders);

  return (
    <DashboardLayout title="Dashboard" description="Vue d'ensemble de votre journée">
      <div className="space-y-4">
        {/* ── Motivation + progress ── */}
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-4">
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <ChefHat className="h-5 w-5 text-foreground" />
                    <div>
                      <p className="font-semibold leading-tight">
                        {getMotivationMessage(stats.progress, stats.toPrepare)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {stats.done}/{stats.total} commande{stats.total !== 1 ? "s" : ""} récupérée{stats.done !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-black tabular-nums">
                    {stats.progress}%
                  </span>
                </div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
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
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {stats.toPrepare} à préparer
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {stats.toPickup} à récupérer
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {stats.done} récupérée{stats.done !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Action cards: À préparer + À récupérer ── */}
        <div className="grid gap-3 grid-cols-2">
          <Link href="/preparation?tab=to_prepare" className="group">
            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 border-amber-200/60 dark:border-amber-800/40">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                  <ChefHat className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">À préparer</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-12 mt-0.5" />
                  ) : (
                    <p className="text-2xl font-black tabular-nums leading-tight">{stats.toPrepare}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-amber-600 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/preparation?tab=ready" className="group">
            <Card className="transition-all hover:shadow-md hover:-translate-y-0.5 border-emerald-200/60 dark:border-emerald-800/40">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                  <PackageCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">À récupérer</p>
                  {isLoading ? (
                    <Skeleton className="h-7 w-12 mt-0.5" />
                  ) : (
                    <p className="text-2xl font-black tabular-nums leading-tight">{stats.toPickup}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600 transition-colors shrink-0" />
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ── Alertes stock ── */}
        {!isLoadingStock && lowStockProducts.length > 0 && (
          <Card className="border-red-200/60 dark:border-red-900/40">
            <CardHeader className="py-3 pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alertes stock
                <span className="ml-auto text-muted-foreground font-normal">
                  {lowStockProducts.length} produit{lowStockProducts.length > 1 ? "s" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="grid gap-1.5 sm:grid-cols-2">
                {lowStockProducts.map((p) => {
                  const stock = parseQty(p.stock ?? 0);
                  const isOut = stock === 0;
                  return (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="truncate">{p.name}</span>
                      <span
                        className={`ml-2 text-xs font-medium whitespace-nowrap px-1.5 py-0.5 rounded-full ${
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
