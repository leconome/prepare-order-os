"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  RefreshCw,
  UserRound,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchOrders,
  fetchTenantSettings,
  formatCurrency,
  type OrderWithItems,
} from "@/lib/api";

// ============ TAB CONFIG ============

type PreparationStatus = "pending" | "in_preparation" | "ready" | "picked_up";

const TABS = [
  {
    key: "to_prepare",
    label: "À préparer",
    statuses: ["pending", "in_preparation"] as PreparationStatus[],
  },
  {
    key: "ready",
    label: "Prêt",
    statuses: ["ready"] as PreparationStatus[],
  },
  {
    key: "picked_up",
    label: "Récupéré",
    statuses: ["picked_up"] as PreparationStatus[],
  },
];

const PAYMENT_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Impayé", variant: "destructive" },
  paid: { label: "Payé", variant: "default" },
  partially_paid: { label: "Partiel", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "outline" },
};

const STATUS_BADGE: Record<PreparationStatus, { label: string; className: string }> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-800" },
  in_preparation: { label: "En cours", className: "bg-blue-100 text-blue-800" },
  ready: { label: "Prêt", className: "bg-green-100 text-green-800" },
  picked_up: { label: "Récupéré", className: "bg-gray-100 text-gray-800" },
};

// ============ ORDER ROW ============

function OrderRow({ order }: { order: OrderWithItems }) {
  const router = useRouter();

  const items = order.items ?? [];
  const preparedCount = items.filter((i) => i.isPrepared).length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (preparedCount / totalCount) * 100 : 0;

  const pickupTime =
    order.pickupTimeStart && order.pickupTimeEnd
      ? `${order.pickupTimeStart}–${order.pickupTimeEnd}`
      : order.pickupTimeStart || null;

  const payment = PAYMENT_BADGE[order.paymentStatus] ?? PAYMENT_BADGE.pending;
  const status = STATUS_BADGE[order.preparationStatus as PreparationStatus];

  return (
    <button
      type="button"
      onClick={() => router.push(`/preparation/${order.id}`)}
      className="flex items-center gap-4 w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/50"
    >
      {/* Ticket number */}
      <div className="shrink-0 w-20">
        <span className="font-mono font-bold text-sm">
          #{order.ticketNumber}
        </span>
      </div>

      {/* Client */}
      <div className="shrink-0 w-32 truncate">
        {order.client?.name ? (
          <span className="text-sm flex items-center gap-1">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{order.client.name}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      {/* Progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Progress value={progressPercent} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground shrink-0">
            {preparedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Pickup time */}
      <div className="shrink-0 w-24 text-center">
        {pickupTime ? (
          <span className="text-xs flex items-center justify-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            {pickupTime}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      {/* Total */}
      <div className="shrink-0 w-20 text-right">
        <span className="text-sm font-medium">{formatCurrency(order.total)}</span>
      </div>

      {/* Payment badge */}
      <div className="shrink-0 w-20">
        <Badge variant={payment.variant} className="text-xs">
          <CreditCard className="h-3 w-3 mr-1" />
          {payment.label}
        </Badge>
      </div>

      {/* Status badge */}
      <div className="shrink-0 w-24">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>
          {status.label}
        </span>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

// ============ MAIN PAGE ============

export default function PreparationPage() {
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const filterDays = tenant?.preparationFilterDays ?? 0;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["preparation-orders", filterDays],
    queryFn: () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - filterDays);
      fromDate.setHours(0, 0, 0, 0);
      return fetchOrders({
        limit: 200,
        fromDate,
        toDate: new Date(new Date().setHours(23, 59, 59, 999)),
      });
    },
    refetchInterval: 30000,
  });

  const orders = data?.data ?? [];

  const tabData = TABS.map((tab) => ({
    ...tab,
    orders: orders.filter((o) =>
      tab.statuses.includes(o.preparationStatus as PreparationStatus),
    ),
  }));

  return (
    <DashboardLayout
      title="Préparation"
      description="Suivi des commandes du jour"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} aujourd&apos;hui
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              queryClient.invalidateQueries({
                queryKey: ["preparation-orders"],
              })
            }
            disabled={isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Actualiser
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-80" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="to_prepare">
            <TabsList>
              {tabData.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                  <Badge
                    variant="secondary"
                    className="ml-1.5 text-xs h-5 px-1.5"
                  >
                    {tab.orders.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {tabData.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                {tab.orders.length === 0 ? (
                  <div className="flex items-center justify-center h-32 rounded-lg border border-dashed text-sm text-muted-foreground">
                    Aucune commande
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tab.orders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
