import { ChevronRight, Clock, CreditCard, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, type OrderWithItems } from "@/lib/api";
import {
  PAYMENT_BADGE,
  type PreparationStatus,
  STATUS_BADGE,
} from "../constants";
import { computeProgress } from "../helpers";

function OrderRow({ order }: { order: OrderWithItems }) {
  const router = useRouter();

  const items = order.items ?? [];
  const { totalUnits: totalCount, preparedUnits: preparedCount } =
    computeProgress(items);
  const progressPercent =
    totalCount > 0 ? (preparedCount / totalCount) * 100 : 0;

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
        <span className="text-sm font-medium">
          {formatCurrency(order.total)}
        </span>
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
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export { OrderRow };
