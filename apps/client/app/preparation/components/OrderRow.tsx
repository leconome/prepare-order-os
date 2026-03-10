"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, MessageSquareText, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatQtyLabel } from "@prepareos/data";
import {
  formatCurrency,
  type OrderWithItems,
  type UpdateOrderStatus,
  updateOrderStatus,
} from "@/lib/api";
import { PAYMENT_LABELS } from "@/lib/constants";
import { type PreparationStatus, STATUS_BADGE } from "../constants";
import { computeProgress } from "../helpers";

function OrderRow({ order }: { order: OrderWithItems }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const items = order.items ?? [];
  const { totalUnits: totalCount, preparedUnits: preparedCount } =
    computeProgress(items);
  const progressPercent =
    totalCount > 0 ? (preparedCount / totalCount) * 100 : 0;

  const pickupTime =
    order.pickupTimeStart && order.pickupTimeEnd
      ? `${order.pickupTimeStart}–${order.pickupTimeEnd}`
      : order.pickupTimeStart || null;

  const status = STATUS_BADGE[order.preparationStatus as PreparationStatus];

  const itemsSummary = items
    .map((item) => {
      const label = formatQtyLabel(item.quantity, item.unit);
      return label !== "1x" ? `${label} ${item.productName}` : item.productName;
    })
    .join(", ");

  const statusMutation = useMutation({
    mutationFn: (data: UpdateOrderStatus) => updateOrderStatus(order.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preparation-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order", order.id] });
    },
  });

  const togglePayment = () => {
    const cycle = {
      pending: "partially_paid",
      partially_paid: "paid",
      paid: "partially_paid",
      refunded: "pending",
    } as const;
    const current = order.paymentStatus ?? "pending";
    const next = cycle[current] ?? "pending";
    statusMutation.mutate({ paymentStatus: next });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/preparation/${order.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/preparation/${order.id}`); }}
      className={`grid grid-cols-10 gap-2 items-center w-full rounded-lg border bg-card p-3 px-4 text-left transition-colors cursor-pointer ${order.preparationStatus === "picked_up" ? "opacity-50 line-through" : "hover:bg-accent/50"}`}
    >
      {/* ── Commande (col 1–6) ── */}
      <div className="col-span-6 min-w-0 space-y-1">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-sm shrink-0 underline underline-offset-2 text-primary">
            #{order.ticketNumber}
          </span>

          <span className="text-sm flex items-center gap-1 shrink-0">
            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate max-w-32">
              {order?.client?.name ?? "---"}
            </span>
          </span>

          <span className="text-xs flex items-center gap-1 text-muted-foreground shrink-0">
            <Calendar className="h-3 w-3" />
            {new Intl.DateTimeFormat("fr-FR", {
              day: "numeric",
              month: "short",
            }).format(new Date(order.createdAt))}
          </span>

          {pickupTime && (
            <span className="text-xs flex items-center gap-1 text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {pickupTime}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="truncate">{itemsSummary}</span>

          {order.internalNote && (
            <span className="flex items-center gap-1 shrink-0 text-amber-600">
              <MessageSquareText className="h-3 w-3" />
              <span className="truncate max-w-60">{order.internalNote}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Paiement (col 7–8) ── */}
      <div className="col-span-2 flex flex-col items-center gap-2">
        <span className="text-sm font-medium shrink-0">
          {formatCurrency(order.total)}
        </span>
        <label
          className={`flex items-center justify-center gap-2 w-full cursor-pointer rounded-md border px-3 py-1.5 transition-all select-none ${
            order.paymentStatus === "paid"
              ? "bg-green-50"
              : order.paymentStatus === "partially_paid"
                ? "bg-amber-50"
                : "bg-background"
          }`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={order.paymentStatus === "paid" ? true : order.paymentStatus === "partially_paid" ? "indeterminate" : false}
            onCheckedChange={() => togglePayment()}
            disabled={statusMutation.isPending}
            className="h-4 w-4 bg-white data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 data-[state=indeterminate]:bg-amber-500 data-[state=indeterminate]:border-amber-500"
          />
          <span
            className={`text-xs font-medium ${
              order.paymentStatus === "paid"
                ? "text-green-700"
                : order.paymentStatus === "partially_paid"
                  ? "text-amber-700"
                  : "text-gray-700"
            }`}
          >
            {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
            {order.paymentStatus === "partially_paid" && parseFloat(order.paidAmount || "0") > 0 && (
              <span className="font-normal">({formatCurrency(order.paidAmount)})</span>
            )}
          </span>
        </label>
      </div>

      {/* ── Statut (col 9–10) ── */}
      <div
        className="col-span-2 flex gap-2 flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 shrink-0">
          <Progress value={progressPercent} className="h-1.5 w-full" />
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {preparedCount}/{totalCount}
          </span>
        </div>
        <Select
          value={order.preparationStatus}
          onValueChange={(value) =>
            statusMutation.mutate({
              preparationStatus: value as PreparationStatus,
            })
          }
          disabled={statusMutation.isPending}
        >
          <SelectTrigger
            className={`shrink-0 gap-1 px-2 w-full py-0.5 text-xs font-medium transition-all active:scale-95 ${status.className}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_BADGE).map(([key, val]) => (
              <SelectItem
                key={key}
                value={key}
                disabled={key === "picked_up" && order.paymentStatus !== "paid"}
              >
                {val.label}
                {key === "picked_up" && order.paymentStatus !== "paid" && " (paiement requis)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { OrderRow };
