"use client";

import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, type OrderWithItems } from "@/lib/api";
import { MenuSubItem } from "./MenuSubItem";

function MenuItemCard({
  item,
  orderId,
}: {
  item: OrderWithItems["items"][number];
  orderId: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const menuItems = item.menuItems ?? [];
  const preparedCount = menuItems.filter((mi) => mi.isPrepared).length;
  const totalCount = menuItems.length;
  const allPrepared = totalCount > 0 && preparedCount === totalCount;

  return (
    <div
      className={`rounded-lg border transition-all ${
        allPrepared ? "bg-green-50 border-green-200" : "bg-card"
      }`}
    >
      {/* Menu header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold shrink-0">
            {item.quantity}x
          </span>
          <span className="text-sm font-medium truncate">
            {item.productName}
          </span>
          <Badge variant="outline" className="text-xs shrink-0">
            Menu
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-xs text-muted-foreground">
            {preparedCount}/{totalCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatCurrency(item.totalPrice)}
          </span>
          {allPrepared && <CheckCircle2 className="h-4 w-4 text-green-600" />}
        </div>
      </button>

      {/* Expanded sub-items */}
      {expanded && menuItems.length > 0 && (
        <div className="px-3 pb-3 space-y-1.5 border-t pt-2">
          {menuItems.map((mi) => (
            <MenuSubItem key={mi.id} menuItem={mi} orderId={orderId} />
          ))}
        </div>
      )}

      {item.notes && (
        <p className="text-xs text-muted-foreground px-3 pb-2 italic">
          {item.notes}
        </p>
      )}
    </div>
  );
}

export { MenuItemCard };
