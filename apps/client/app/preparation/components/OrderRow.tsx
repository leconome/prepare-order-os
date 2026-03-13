"use client";

import { formatQtyLabel } from "@prepareos/data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Calendar,
  Clock,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type OrderWithItems,
  type UpdateOrderStatus,
  updateOrderStatus,
} from "@/lib/api";
import { type PreparationStatus, STATUS_BADGE } from "../constants";
import { computeProgress } from "../helpers";

function OrderRow({ order, even = false }: { order: OrderWithItems; even?: boolean }) {
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

  const isOverdue = (() => {
    if (!order.pickupDate) return false;
    if (order.preparationStatus === "picked_up") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(order.pickupDate) < today;
  })();

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/orders/${order.id}?view=preparation`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ")
          router.push(`/orders/${order.id}?view=preparation`);
      }}
      className={`grid grid-cols-8 gap-2 items-center w-full border-b py-2 px-4 text-sm text-left transition-colors cursor-pointer ${isOverdue ? "border-red-300 bg-red-50/50 dark:bg-red-950/10" : even ? "bg-card" : "bg-muted/30"} ${order.preparationStatus === "picked_up" ? "opacity-50 line-through" : "hover:bg-accent/50"}`}
    >
      {/* ── Commande (col 1–6) ── */}
      <div className="col-span-6 min-w-0 space-y-1">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold  shrink-0 underline underline-offset-2 text-primary">
            #{order.ticketNumber}
          </span>

          <span className=" flex items-center gap-1 shrink-0">
            <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate max-w-32">
              {order?.client?.name ?? "---"}
            </span>
          </span>

          {order.pickupDate && (
            <Badge
              variant={isOverdue ? "destructive" : "outline"}
              className={`flex items-center gap-1 shrink-0 text-xs ${isOverdue ? "" : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800"}`}
            >
              {isOverdue ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Calendar className="h-3 w-3" />
              )}
              {isOverdue && "En retard · "}
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "short",
              }).format(new Date(order.pickupDate))}
            </Badge>
          )}

          {pickupTime && (
            <span className=" flex items-center gap-1 text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {pickupTime}
            </span>
          )}

          {order.pointOfSale && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 shrink-0"
            >
              {order.pointOfSale.name}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3  text-muted-foreground">
          <span className="truncate">{itemsSummary}</span>

          {order.internalNote && (
            <span className="flex items-center gap-1 shrink-0 text-amber-600">
              <MessageSquareText className="h-3 w-3" />
              <span className="truncate max-w-60">{order.internalNote}</span>
            </span>
          )}
        </div>
      </div>

      {/* ── Statut (col 7–8) ── */}
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
            className={`shrink-0 gap-1 px-2 w-full py-0.5  font-medium transition-all active:scale-95 ${status.className}`}
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
                {key === "picked_up" &&
                  order.paymentStatus !== "paid" &&
                  " (paiement requis)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export { OrderRow };
