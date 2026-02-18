"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import {
  type OrderMenuItem,
  type OrderWithItems,
  toggleMenuItemPrepared,
} from "@/lib/api";

function MenuSubItem({
  menuItem,
  orderId,
}: {
  menuItem: OrderMenuItem;
  orderId: string;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      toggleMenuItemPrepared(orderId, menuItem.id, !menuItem.isPrepared),
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
          items: old.items.map((item) => ({
            ...item,
            menuItems: item.menuItems?.map((mi) =>
              mi.id === menuItem.id
                ? { ...mi, isPrepared: !menuItem.isPrepared }
                : mi,
            ),
          })),
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
      className={`w-full text-left rounded-md border p-2 transition-all text-sm ${
        menuItem.isPrepared
          ? "bg-green-50 border-green-200 hover:bg-green-100"
          : "bg-card hover:bg-accent/50"
      } ${mutation.isPending ? "opacity-60" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold shrink-0">{menuItem.quantity}x</span>
          <span className="truncate">{menuItem.productName}</span>
        </div>
        {menuItem.isPrepared && (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 ml-2" />
        )}
      </div>
    </button>
  );
}

export { MenuSubItem };
