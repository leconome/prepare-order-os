import type { OrderWithItems } from "@prepareos/data";

function computeProgress(items: OrderWithItems["items"]) {
  let totalUnits = 0;
  let preparedUnits = 0;

  for (const item of items) {
    if (item.isMenu && item.menuItems && item.menuItems.length > 0) {
      for (const mi of item.menuItems) {
        totalUnits += mi.quantity;
        if (mi.isPrepared) preparedUnits += mi.quantity;
      }
    } else {
      totalUnits += 1;
      if (item.isPrepared) preparedUnits += 1;
    }
  }

  return { totalUnits, preparedUnits };
}

export { computeProgress };
