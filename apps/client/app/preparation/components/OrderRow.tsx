import {
  ChevronRight,
  Clock,
  CreditCard,
  MessageSquareText,
  UserRound,
} from "lucide-react";
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

  const itemsSummary = items
    .map((item) =>
      item.quantity > 1
        ? `${item.quantity}x ${item.productName}`
        : item.productName,
    )
    .join(", ");

  return (
    <button
      type="button"
      onClick={() => router.push(`/preparation/${order.id}`)}
      className="flex items-center gap-4 w-full rounded-lg border bg-card p-3 px-4 text-left transition-colors hover:bg-accent/50"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Top row: ticket, client, pickup, total, payment, status */}
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-sm shrink-0">
            #{order.ticketNumber}
          </span>

          {order.client?.name && (
            <span className="text-sm flex items-center gap-1 shrink-0">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate max-w-32">{order.client.name}</span>
            </span>
          )}

          <div className="flex items-center gap-1 shrink-0">
            <Progress value={progressPercent} className="h-1.5 w-16" />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {preparedCount}/{totalCount}
            </span>
          </div>

          <div className="flex-1" />

          {pickupTime && (
            <span className="text-xs flex items-center gap-1 text-muted-foreground shrink-0">
              <Clock className="h-3 w-3" />
              {pickupTime}
            </span>
          )}

          <span className="text-sm font-medium shrink-0">
            {formatCurrency(order.total)}
          </span>

          <Badge variant={payment.variant} className="text-xs shrink-0">
            <CreditCard className="h-3 w-3 mr-1" />
            {payment.label}
          </Badge>

          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${status.className}`}
          >
            {status.label}
          </span>
        </div>

        {/* Bottom row: items composition + internal note */}
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

      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

export { OrderRow };
