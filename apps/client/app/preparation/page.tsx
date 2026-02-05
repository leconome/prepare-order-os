"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import classnames from "classnames";
import classNames from "classnames";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOrders,
  formatCurrency,
  type OrderWithItems,
  type UpdateOrderStatus,
  updateOrderStatus,
} from "@/lib/api";

// ============ COLUMNS CONFIG ============

type PreparationStatus = "pending" | "in_preparation" | "ready" | "picked_up";

const COLUMNS: {
  key: PreparationStatus;
  label: string;
  color: string;
  cardBorder: string;
  nextStatus?: PreparationStatus;
  nextLabel?: string;
  prevStatus?: PreparationStatus;
  prevLabel?: string;
}[] = [
  {
    key: "pending",
    label: "En attente",
    color: "bg-amber-500",
    cardBorder: "border-l-amber-500",
    nextStatus: "in_preparation",
    nextLabel: "Préparer",
  },
  {
    key: "in_preparation",
    label: "En préparation",
    color: "bg-blue-500",
    cardBorder: "border-l-blue-500",
    prevStatus: "pending",
    prevLabel: "Attente",
    nextStatus: "ready",
    nextLabel: "Prêt",
  },
  {
    key: "ready",
    label: "Prêt",
    color: "bg-green-500",
    cardBorder: "border-l-green-500",
    prevStatus: "in_preparation",
    prevLabel: "Préparer",
    nextStatus: "picked_up",
    nextLabel: "Récupéré",
  },
  {
    key: "picked_up",
    label: "Récupéré",
    color: "bg-gray-400",
    cardBorder: "border-l-gray-400",
    prevStatus: "ready",
    prevLabel: "Prêt",
  },
];

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Impayé",
  paid: "Payé",
  partially_paid: "Partiel",
  refunded: "Remboursé",
};

// ============ ORDER CARD ============

function OrderCard({
  order,
  column,
}: {
  order: OrderWithItems;
  column: (typeof COLUMNS)[number];
}) {
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (data: UpdateOrderStatus) => updateOrderStatus(order.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preparation-orders"] });
    },
  });

  const togglePayment = () => {
    const next = order.paymentStatus === "paid" ? "pending" : "paid";
    statusMutation.mutate({ paymentStatus: next });
  };

  const isPending = statusMutation.isPending;

  const pickupTime =
    order.pickupTimeStart && order.pickupTimeEnd
      ? `${order.pickupTimeStart}–${order.pickupTimeEnd}`
      : order.pickupTimeStart || null;

  return (
    <Card className={`border-l-4 ${column.cardBorder} p-3 space-y-2`}>
      {/* Header: ticket + client */}
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-sm">
          #{order.ticketNumber}
        </span>
        {order.client?.name && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[120px]">
            <UserRound className="h-3 w-3 shrink-0" />
            {order.client.name}
          </span>
        )}
      </div>

      {/* Products list */}
      {order.items && order.items.length > 0 && (
        <div className="space-y-0.5">
          {order.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between text-xs"
            >
              <span className="truncate">
                <span className="font-medium">{item.quantity}x</span>{" "}
                {item.productName}
              </span>
              <span className="text-muted-foreground ml-2 shrink-0">
                {formatCurrency(item.totalPrice)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="text-xs font-medium text-right border-t pt-1">
        Total : {formatCurrency(order.total)}
      </div>

      {/* Pickup time */}
      {pickupTime && (
        <div className="text-xs flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {pickupTime}
        </div>
      )}

      {/* Actions: ← | Payé | → */}
      <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
        <div>
          {column.prevStatus && (
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10"
              disabled={isPending}
              onClick={() =>
                statusMutation.mutate({ preparationStatus: column.prevStatus })
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        <label
          className={classNames(
            "flex items-center justify-between gap-2 cursor-pointer transition-all animate-in select-none rounded-md h-full border px-3 py-2",
            {
              "bg-green-50": order.paymentStatus === "paid",
              "bg-background": order.paymentStatus !== "paid",
            },
          )}
        >
          <Checkbox
            checked={order.paymentStatus === "paid"}
            onCheckedChange={() => togglePayment()}
            disabled={isPending}
            className="h-5 w-5 bg-white data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
          <span
            className={`text-sm font-medium ${order.paymentStatus === "paid" ? "text-green-700 dark:text-green-400" : "text-gray-700 dark:text-gray-400"}`}
          >
            {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
          </span>
        </label>

        <div className="flex justify-end">
          {column.nextStatus && (
            <Button
              size="icon"
              variant="outline"
              className="h-10 w-10"
              disabled={isPending}
              onClick={() =>
                statusMutation.mutate({ preparationStatus: column.nextStatus })
              }
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ============ MAIN PAGE ============

export default function PreparationPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["preparation-orders"],
    queryFn: () =>
      fetchOrders({
        limit: 100,
        fromDate: new Date(new Date().setHours(0, 0, 0, 0)),
        toDate: new Date(new Date().setHours(23, 59, 59, 999)),
      }),
    refetchInterval: 30000,
  });

  const orders = data?.data ?? [];

  const grouped = COLUMNS.map((col) => ({
    ...col,
    orders: orders.filter((o) => o.preparationStatus === col.key),
  }));

  return (
    <DashboardLayout
      title="Préparation"
      description="Suivi des commandes du jour"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {orders.length} commande{orders.length !== 1 ? "s" : ""} aujourd'hui
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
          <div className="grid grid-cols-4 gap-4">
            {COLUMNS.map((col) => (
              <div key={col.key} className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {grouped.map((col) => (
              <div key={col.key} className="space-y-2">
                {/* Column header */}
                <div className="flex items-center gap-2 pb-1">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <span className="text-sm font-medium">{col.label}</span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs h-5 px-1.5"
                  >
                    {col.orders.length}
                  </Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[100px]">
                  {col.orders.length === 0 ? (
                    <div className="flex items-center justify-center h-24 rounded-lg border border-dashed text-xs text-muted-foreground">
                      Aucune commande
                    </div>
                  ) : (
                    col.orders.map((order) => (
                      <OrderCard key={order.id} order={order} column={col} />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
