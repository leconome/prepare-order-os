"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  formatCurrency,
  type OrderWithItems,
  toggleOrderItemPrepared,
} from "@/lib/api";

function ItemCard({
  item,
  orderId,
  isPreparedSide,
}: {
  item: OrderWithItems["items"][number];
  orderId: string;
  isPreparedSide: boolean;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      toggleOrderItemPrepared(orderId, item.id, !isPreparedSide),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["order", orderId] });
      const previous = queryClient.getQueryData<OrderWithItems>([
        "order",
        orderId,
      ]);

      queryClient.setQueryData<OrderWithItems>(["order", orderId], (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((i) =>
            i.id === item.id ? { ...i, isPrepared: !isPreparedSide } : i,
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["order", orderId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["preparation-orders"] });
    },
  });

  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className={`w-full text-left rounded-lg border p-3 transition-all ${
        isPreparedSide
          ? "bg-green-50 border-green-200 hover:bg-green-100"
          : "bg-card hover:bg-accent/50"
      } ${mutation.isPending ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold shrink-0">
            {item.quantity}x
          </span>
          <span className="text-sm truncate">{item.productName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">
            {formatCurrency(item.totalPrice)}
          </span>
          {isPreparedSide && (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
        </div>
      </div>
      {item.notes && (
        <p className="text-xs text-muted-foreground mt-1 italic">
          {item.notes}
        </p>
      )}
    </button>
  );
}

export { ItemCard };
