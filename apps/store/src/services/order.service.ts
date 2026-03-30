import {
  type CreateOrder,
  type CreateOrderItem,
  clients,
  type OrderFilters,
  orderItems,
  orderMenuItems,
  orders,
  products,
  productVariants,
  stockDeduction,
  type Unit,
  type UpdateOrder,
  type UpdateOrderItems,
  type UpdateOrderStatus,
} from "@prepareos/data";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { type Database, db } from "../db/index.js";
import { getMenuById } from "./menu.service.js";
import { generateTicketNumber } from "./ticket.service.js";
import * as wcService from "./woocommerce.service.js";

function calculateTotals(
  subtotal: number,
  discountType?: string | null,
  discountValue?: string | null,
) {
  let discountAmount = 0;
  if (discountType && discountValue) {
    const val = parseFloat(discountValue);
    if (!isNaN(val) && val > 0) {
      discountAmount =
        discountType === "percentage" ? (subtotal * val) / 100 : val;
      discountAmount = Math.min(discountAmount, subtotal);
    }
  }
  // Prices are TTC (tax included) — extract VAT instead of adding it on top
  const total = subtotal - discountAmount;
  const taxRate = 0.2;
  const taxTotal = total - total / (1 + taxRate);
  return { discountAmount, taxTotal, total };
}

type TxOrDb = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Restore stock for a list of order items (regular + menu sub-items).
 * Accepts an optional transaction handle.
 */
async function restoreStockForItems(
  tenantId: string,
  items: {
    productId: string;
    variantId?: string | null;
    quantity: string | number;
    unit?: Unit;
    isMenu: boolean;
    menuItems?: { productId: string; quantity: number }[];
  }[],
  tx: TxOrDb = db,
) {
  for (const item of items) {
    if (item.isMenu && item.menuItems) {
      for (const menuItem of item.menuItems) {
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${Number(menuItem.quantity)}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, menuItem.productId),
              eq(products.tenantId, tenantId),
              isNotNull(products.stock),
              eq(products.unitType, "piece"),
            ),
          );
      }
    } else if (item.variantId) {
      const unit = item.unit ?? "piece";
      await tx
        .update(productVariants)
        .set({
          stock: sql`${productVariants.stock} + ${stockDeduction(item.quantity, unit)}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(productVariants.id, item.variantId),
            eq(productVariants.tenantId, tenantId),
            isNotNull(productVariants.stock),
          ),
        );
    } else {
      const unit = item.unit ?? "piece";
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${stockDeduction(item.quantity, unit)}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, item.productId),
            eq(products.tenantId, tenantId),
            isNotNull(products.stock),
            eq(products.unitType, unit),
          ),
        );
    }
  }
}

/**
 * Insert order items (regular + menus) and deduct stock.
 * Returns the computed subtotal.
 */
async function insertItemsAndDeductStock(
  tenantId: string,
  orderId: string,
  items: CreateOrderItem[],
  tx: TxOrDb = db,
): Promise<number> {
  let subtotal = 0;

  const regularItems = items.filter((item) => !item.menuId);
  const menuItemRequests = items.filter((item) => item.menuId);

  // Process regular items
  const regularItemsToInsert = regularItems.map((item) => {
    const totalPrice = Number(item.unitPrice) * item.quantity;
    subtotal += totalPrice;
    return {
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId ?? null,
      variantName: item.variantName ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: totalPrice.toFixed(2),
      unit: item.unit ?? ("piece" as const),
      isMenu: false,
      notes: item.notes ?? null,
    };
  });

  // Process menu items
  const menuItemsToInsert: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    unit: "piece";
    isMenu: boolean;
    notes: string | null;
    menuProducts: {
      productId: string;
      productName: string;
      quantity: number;
    }[];
  }[] = [];

  for (const menuReq of menuItemRequests) {
    if (!menuReq.menuId) continue;
    const menu = await getMenuById(tenantId, menuReq.menuId);
    if (!menu) continue;

    const unitPrice = Number(menuReq.unitPrice);
    subtotal += unitPrice * menuReq.quantity;

    for (let i = 0; i < menuReq.quantity; i++) {
      menuItemsToInsert.push({
        productId: menuReq.productId,
        productName: menuReq.productName,
        quantity: 1,
        unitPrice: menuReq.unitPrice,
        totalPrice: unitPrice.toFixed(2),
        unit: "piece" as const,
        isMenu: true,
        notes: menuReq.notes ?? null,
        menuProducts: menuReq.menuProducts && menuReq.menuProducts.length > 0
          ? menuReq.menuProducts
          : menu.products.map((mp) => ({
              productId: mp.product.id,
              productName: mp.product.name,
              quantity: mp.quantity,
            })),
      });
    }
  }

  // Insert regular items
  if (regularItemsToInsert.length > 0) {
    await tx.insert(orderItems).values(
      regularItemsToInsert.map((item) => ({
        ...item,
        quantity: String(item.quantity),
        orderId,
      })),
    );

    for (const item of regularItemsToInsert) {
      const itemQty = stockDeduction(item.quantity, item.unit);

      if (item.variantId) {
        // Deduct from variant stock
        const result = await tx
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} - ${itemQty}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.tenantId, tenantId),
              isNotNull(productVariants.stock),
              gte(productVariants.stock, String(itemQty)),
            ),
          )
          .returning({ id: productVariants.id });

        if (result.length === 0) {
          const hasStock = await tx
            .select({ stock: productVariants.stock })
            .from(productVariants)
            .where(
              and(
                eq(productVariants.id, item.variantId),
                eq(productVariants.tenantId, tenantId),
                isNotNull(productVariants.stock),
              ),
            );
          if (hasStock.length > 0) {
            throw new Error(
              `Stock insuffisant pour "${item.productName}${item.variantName ? ` — ${item.variantName}` : ""}" (stock: ${hasStock[0].stock}, demandé: ${item.quantity})`,
            );
          }
        }
      } else {
        // Deduct from product stock (existing logic)
        const result = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${itemQty}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, item.productId),
              eq(products.tenantId, tenantId),
              isNotNull(products.stock),
              eq(products.unitType, item.unit),
              gte(products.stock, String(itemQty)),
            ),
          )
          .returning({ id: products.id });

        if (result.length === 0) {
          const hasStock = await tx
            .select({ stock: products.stock, unitType: products.unitType })
            .from(products)
            .where(
              and(
                eq(products.id, item.productId),
                eq(products.tenantId, tenantId),
                isNotNull(products.stock),
                eq(products.unitType, item.unit),
              ),
            );
          if (hasStock.length > 0) {
            throw new Error(
              `Stock insuffisant pour "${item.productName}" (stock: ${hasStock[0].stock}, demandé: ${item.quantity})`,
            );
          }
        }
      }
    }
  }

  // Insert menu items + their sub-items
  for (const menuItem of menuItemsToInsert) {
    const { menuProducts: menuProds, ...itemData } = menuItem;
    const [insertedItem] = await tx
      .insert(orderItems)
      .values({ ...itemData, quantity: String(itemData.quantity), orderId })
      .returning();

    if (menuProds.length > 0) {
      await tx.insert(orderMenuItems).values(
        menuProds.map((mp) => ({
          orderItemId: insertedItem.id,
          productId: mp.productId,
          productName: mp.productName,
          quantity: mp.quantity,
        })),
      );

      for (const mp of menuProds) {
        const result = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${mp.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, mp.productId),
              eq(products.tenantId, tenantId),
              isNotNull(products.stock),
              eq(products.unitType, "piece"),
              gte(products.stock, String(mp.quantity)),
            ),
          )
          .returning({ id: products.id });

        if (result.length === 0) {
          const hasStock = await tx
            .select({ stock: products.stock, unitType: products.unitType })
            .from(products)
            .where(
              and(
                eq(products.id, mp.productId),
                eq(products.tenantId, tenantId),
                isNotNull(products.stock),
                eq(products.unitType, "piece"),
              ),
            );
          if (hasStock.length > 0) {
            throw new Error(
              `Stock insuffisant pour "${mp.productName}" (stock: ${hasStock[0].stock}, demandé: ${mp.quantity})`,
            );
          }
        }
      }
    }
  }

  return subtotal;
}

export async function listOrders(tenantId: string, filters: OrderFilters) {
  const {
    search,
    clientId,
    paymentStatus,
    preparationStatus,
    createdById,
    assignedToId,
    pickupDate,
    pickupDateFrom,
    pickupDateTo,
    fromDate,
    toDate,
    posId,
    page = 1,
    limit = 20,
  } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.tenantId, tenantId)];

  if (search) {
    const cleanSearch = search.replace(/^#/, "");
    const pattern = `%${cleanSearch}%`;
    const searchCondition = or(
      ilike(orders.ticketNumber, pattern),
      exists(
        db
          .select({ v: sql`1` })
          .from(clients)
          .where(
            and(eq(clients.id, orders.clientId), ilike(clients.name, pattern)),
          ),
      ),
      exists(
        db
          .select({ v: sql`1` })
          .from(orderItems)
          .where(
            and(
              eq(orderItems.orderId, orders.id),
              ilike(orderItems.productName, pattern),
            ),
          ),
      ),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  if (clientId) {
    conditions.push(eq(orders.clientId, clientId));
  }

  if (paymentStatus) {
    conditions.push(eq(orders.paymentStatus, paymentStatus));
  }

  if (preparationStatus) {
    conditions.push(eq(orders.preparationStatus, preparationStatus));
  }

  if (createdById) {
    conditions.push(eq(orders.createdById, createdById));
  }

  if (assignedToId) {
    conditions.push(eq(orders.assignedToId, assignedToId));
  }

  if (posId) {
    conditions.push(eq(orders.posId, posId));
  }

  if (pickupDate) {
    const startOfDay = new Date(pickupDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(pickupDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(orders.pickupDate, startOfDay));
    conditions.push(lte(orders.pickupDate, endOfDay));
  }

  if (pickupDateFrom) {
    conditions.push(gte(orders.pickupDate, pickupDateFrom));
  }

  if (pickupDateTo) {
    conditions.push(lte(orders.pickupDate, pickupDateTo));
  }

  if (fromDate) {
    conditions.push(gte(orders.createdAt, fromDate));
  }

  if (toDate) {
    conditions.push(lte(orders.createdAt, toDate));
  }

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.query.orders.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: desc(orders.createdAt),
      with: {
        items: {
          orderBy: asc(orderItems.createdAt),
          with: {
            menuItems: {
              orderBy: asc(orderMenuItems.id),
            },
          },
        },
        client: {
          columns: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        createdBy: {
          columns: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          columns: {
            id: true,
            name: true,
          },
        },
        pointOfSale: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    }),
    db.select({ count: sql<number>`count(*)` }).from(orders).where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getOrderById(tenantId: string, id: string) {
  return db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.tenantId, tenantId)),
    with: {
      items: {
        orderBy: asc(orderItems.createdAt),
        with: {
          menuItems: {
            orderBy: asc(orderMenuItems.id),
          },
        },
      },
      client: {
        columns: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      },
      createdBy: {
        columns: {
          id: true,
          name: true,
        },
      },
      assignedTo: {
        columns: {
          id: true,
          name: true,
        },
      },
      pointOfSale: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });
}

export async function createOrder(tenantId: string, data: CreateOrder) {
  const ticketNumber = await generateTicketNumber(tenantId);

  const [order] = await db
    .insert(orders)
    .values({
      ticketNumber,
      clientId: data.clientId ?? null,
      pickupDate: data.pickupDate ?? null,
      pickupTimeStart: data.pickupTimeStart ?? null,
      pickupTimeEnd: data.pickupTimeEnd ?? null,
      clientNote: data.clientNote ?? null,
      internalNote: data.internalNote ?? null,
      createdById: data.createdById ?? null,
      assignedToId: data.assignedToId ?? null,
      posId: data.posId ?? null,
      source: data.source ?? "comptoir",
      paymentStatus: data.paymentStatus ?? "pending",
      subtotal: "0.00",
      taxTotal: "0.00",
      total: "0.00",
      tenantId,
    })
    .returning();

  const subtotal = await insertItemsAndDeductStock(
    tenantId,
    order.id,
    data.items,
  );

  const { discountAmount, taxTotal, total } = calculateTotals(
    subtotal,
    data.discountType,
    data.discountValue,
  );

  await db
    .update(orders)
    .set({
      subtotal: subtotal.toFixed(2),
      discountType: data.discountType ?? null,
      discountValue: data.discountValue ?? "0",
      discountAmount: discountAmount.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      paidAmount: data.paidAmount ?? "0.00",
    })
    .where(eq(orders.id, order.id));

  // Push stock updates for affected products
  const affectedProductIds = new Set(data.items.map((i: { productId: string }) => i.productId));
  for (const pid of affectedProductIds) {
    wcService.pushStock(tenantId, pid).catch(() => {});
  }

  return getOrderById(tenantId, order.id);
}

export async function updateOrder(
  tenantId: string,
  id: string,
  data: UpdateOrder,
) {
  const updateData: Partial<typeof orders.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.paymentStatus !== undefined)
    updateData.paymentStatus = data.paymentStatus;
  if (data.preparationStatus !== undefined)
    updateData.preparationStatus = data.preparationStatus;
  if (data.pickupDate !== undefined) updateData.pickupDate = data.pickupDate;
  if (data.pickupTimeStart !== undefined)
    updateData.pickupTimeStart = data.pickupTimeStart;
  if (data.pickupTimeEnd !== undefined)
    updateData.pickupTimeEnd = data.pickupTimeEnd;
  if (data.clientNote !== undefined) updateData.clientNote = data.clientNote;
  if (data.internalNote !== undefined)
    updateData.internalNote = data.internalNote;
  if (data.createdById !== undefined) updateData.createdById = data.createdById;
  if (data.assignedToId !== undefined)
    updateData.assignedToId = data.assignedToId;
  if (data.posId !== undefined) updateData.posId = data.posId;
  if (data.source !== undefined) updateData.source = data.source;
  if (data.smsNotifiedAt !== undefined)
    updateData.smsNotifiedAt = data.smsNotifiedAt;
  if (data.discountType !== undefined)
    updateData.discountType = data.discountType;
  if (data.discountValue !== undefined)
    updateData.discountValue = data.discountValue ?? "0";
  if (data.paidAmount !== undefined)
    updateData.paidAmount = data.paidAmount ?? "0.00";

  const newItems = data.items;
  if (newItems) {
    // Replace items atomically: restore stock, delete old, insert new, recalculate totals
    await db.transaction(async (tx) => {
      // 1. Fetch existing items with menu sub-items
      const existingItems = await tx.query.orderItems.findMany({
        where: eq(orderItems.orderId, id),
        with: { menuItems: true },
      });

      // 2. Restore stock for old items
      await restoreStockForItems(tenantId, existingItems, tx);

      // 3. Delete old items (cascade deletes orderMenuItems)
      await tx.delete(orderItems).where(eq(orderItems.orderId, id));

      // 4. Insert new items and deduct stock
      const subtotal = await insertItemsAndDeductStock(
        tenantId,
        id,
        newItems,
        tx,
      );

      // 5. Recalculate totals with discount
      // Use discount from data if provided, otherwise fetch existing order discount
      let discType = data.discountType;
      let discValue = data.discountValue;
      if (discType === undefined || discValue === undefined) {
        const existingOrder = await tx.query.orders.findFirst({
          where: eq(orders.id, id),
        });
        if (discType === undefined) discType = existingOrder?.discountType;
        if (discValue === undefined) discValue = existingOrder?.discountValue;
      }
      const { discountAmount, taxTotal, total } = calculateTotals(
        subtotal,
        discType,
        discValue,
      );

      // 6. Auto-reset preparation status since items changed
      updateData.preparationStatus = "pending";
      updateData.subtotal = subtotal.toFixed(2);
      updateData.discountAmount = discountAmount.toFixed(2);
      updateData.taxTotal = taxTotal.toFixed(2);
      updateData.total = total.toFixed(2);

      await tx
        .update(orders)
        .set(updateData)
        .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
    });
  } else if (
    data.discountType !== undefined ||
    data.discountValue !== undefined
  ) {
    // Discount changed without item changes — recalculate totals from existing subtotal
    const existingOrder = await db.query.orders.findFirst({
      where: and(eq(orders.id, id), eq(orders.tenantId, tenantId)),
    });
    if (existingOrder) {
      const subtotal = parseFloat(existingOrder.subtotal);
      const discType =
        data.discountType !== undefined
          ? data.discountType
          : existingOrder.discountType;
      const discValue =
        data.discountValue !== undefined
          ? data.discountValue
          : existingOrder.discountValue;
      const { discountAmount, taxTotal, total } = calculateTotals(
        subtotal,
        discType,
        discValue,
      );
      updateData.discountAmount = discountAmount.toFixed(2);
      updateData.taxTotal = taxTotal.toFixed(2);
      updateData.total = total.toFixed(2);
    }
    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  } else {
    // Metadata-only update (no item or discount changes)
    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  }

  return getOrderById(tenantId, id);
}

export async function updateOrderItems(
  tenantId: string,
  id: string,
  data: UpdateOrderItems,
) {
  // 1. Get existing items to restore stock
  const existingItems = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, id),
    with: { menuItems: true },
  });

  // 2. Restore stock for old items
  await restoreStockForItems(tenantId, existingItems);

  // 3. Delete old items (cascade deletes orderMenuItems too)
  await db.delete(orderItems).where(eq(orderItems.orderId, id));

  // 4. Insert new items (same logic as createOrder)
  let subtotal = 0;

  const regularItems = data.items.filter((item) => !item.menuId);
  const menuItemRequests = data.items.filter((item) => item.menuId);

  const regularItemsToInsert = regularItems.map((item) => {
    const totalPrice = Number(item.unitPrice) * item.quantity;
    subtotal += totalPrice;
    return {
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId ?? null,
      variantName: item.variantName ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: totalPrice.toFixed(2),
      unit: item.unit ?? ("piece" as const),
      isMenu: false,
      notes: item.notes ?? null,
    };
  });

  const menuItemsToInsert: {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    unit: "piece";
    isMenu: boolean;
    notes: string | null;
    menuProducts: {
      productId: string;
      productName: string;
      quantity: number;
    }[];
  }[] = [];

  for (const menuReq of menuItemRequests) {
    const menu = await getMenuById(tenantId, menuReq.menuId!);
    if (!menu) continue;

    const unitPrice = Number(menuReq.unitPrice);
    subtotal += unitPrice * menuReq.quantity;

    for (let i = 0; i < menuReq.quantity; i++) {
      menuItemsToInsert.push({
        productId: menuReq.productId,
        productName: menuReq.productName,
        quantity: 1,
        unitPrice: menuReq.unitPrice,
        totalPrice: unitPrice.toFixed(2),
        unit: "piece" as const,
        isMenu: true,
        notes: menuReq.notes ?? null,
        menuProducts: menuReq.menuProducts && menuReq.menuProducts.length > 0
          ? menuReq.menuProducts
          : menu.products.map((mp) => ({
              productId: mp.product.id,
              productName: mp.product.name,
              quantity: mp.quantity,
            })),
      });
    }
  }

  // 5. Insert regular items
  if (regularItemsToInsert.length > 0) {
    await db.insert(orderItems).values(
      regularItemsToInsert.map((item) => ({
        ...item,
        quantity: String(item.quantity),
        orderId: id,
      })),
    );

    for (const item of regularItemsToInsert) {
      if (item.variantId) {
        await db
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} - ${stockDeduction(item.quantity, item.unit)}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productVariants.id, item.variantId),
              eq(productVariants.tenantId, tenantId),
              isNotNull(productVariants.stock),
            ),
          );
      } else {
        await db
          .update(products)
          .set({
            stock: sql`${products.stock} - ${stockDeduction(item.quantity, item.unit)}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, item.productId),
              eq(products.tenantId, tenantId),
              isNotNull(products.stock),
              eq(products.unitType, item.unit),
            ),
          );
      }
    }
  }

  // 6. Insert menu items + sub-items
  for (const menuItem of menuItemsToInsert) {
    const { menuProducts: menuProds, ...itemData } = menuItem;
    const [insertedItem] = await db
      .insert(orderItems)
      .values({ ...itemData, quantity: String(itemData.quantity), orderId: id })
      .returning();

    if (menuProds.length > 0) {
      await db.insert(orderMenuItems).values(
        menuProds.map((mp) => ({
          orderItemId: insertedItem.id,
          productId: mp.productId,
          productName: mp.productName,
          quantity: mp.quantity,
        })),
      );

      for (const mp of menuProds) {
        await db
          .update(products)
          .set({
            stock: sql`${products.stock} - ${mp.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, mp.productId),
              eq(products.tenantId, tenantId),
              isNotNull(products.stock),
              eq(products.unitType, "piece"),
            ),
          );
      }
    }
  }

  // 7. Recalculate totals (preserve existing discount)
  const existingOrder = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.tenantId, tenantId)),
  });
  const { discountAmount, taxTotal, total } = calculateTotals(
    subtotal,
    existingOrder?.discountType,
    existingOrder?.discountValue,
  );

  await db
    .update(orders)
    .set({
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));

  return getOrderById(tenantId, id);
}

export async function updateOrderStatus(
  tenantId: string,
  id: string,
  data: UpdateOrderStatus,
) {
  const updateData: Partial<typeof orders.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.paymentStatus !== undefined)
    updateData.paymentStatus = data.paymentStatus;
  if (data.preparationStatus !== undefined)
    updateData.preparationStatus = data.preparationStatus;
  if (data.paidAmount !== undefined) updateData.paidAmount = data.paidAmount;

  await db
    .update(orders)
    .set(updateData)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));

  return getOrderById(tenantId, id);
}

export async function toggleItemPrepared(
  tenantId: string,
  orderId: string,
  itemId: string,
  isPrepared: boolean,
) {
  // Verify order belongs to tenant
  const order = await getOrderById(tenantId, orderId);
  if (!order) return null;

  // Update the item
  const [updated] = await db
    .update(orderItems)
    .set({ isPrepared, updatedAt: new Date() })
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
    .returning();

  if (!updated) return null;

  // Determine new order preparation status based on all items
  const allItems = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });
  const allItemsPrepared =
    allItems.length > 0 && allItems.every((i) => i.isPrepared);

  if (
    allItemsPrepared &&
    order.preparationStatus !== "ready" &&
    order.preparationStatus !== "picked_up"
  ) {
    await db
      .update(orders)
      .set({ preparationStatus: "ready", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  } else if (!allItemsPrepared && order.preparationStatus === "ready") {
    await db
      .update(orders)
      .set({ preparationStatus: "in_preparation", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  } else if (isPrepared && order.preparationStatus === "pending") {
    await db
      .update(orders)
      .set({ preparationStatus: "in_preparation", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  return getOrderById(tenantId, orderId);
}

export async function toggleMenuItemPrepared(
  tenantId: string,
  orderId: string,
  menuItemId: string,
  isPrepared: boolean,
) {
  // Verify order belongs to tenant
  const order = await getOrderById(tenantId, orderId);
  if (!order) return null;

  // Update the menu item
  const [updated] = await db
    .update(orderMenuItems)
    .set({ isPrepared })
    .where(eq(orderMenuItems.id, menuItemId))
    .returning();

  if (!updated) return null;

  // Check if all menu items for the parent order item are prepared
  const parentItemId = updated.orderItemId;
  const allMenuItems = await db.query.orderMenuItems.findMany({
    where: eq(orderMenuItems.orderItemId, parentItemId),
  });

  const allMenuPrepared = allMenuItems.every((mi) => mi.isPrepared);
  await db
    .update(orderItems)
    .set({ isPrepared: allMenuPrepared, updatedAt: new Date() })
    .where(eq(orderItems.id, parentItemId));

  // Determine new order preparation status based on all items
  const allItems = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, orderId),
  });
  const allItemsPrepared =
    allItems.length > 0 && allItems.every((i) => i.isPrepared);

  if (
    allItemsPrepared &&
    order.preparationStatus !== "ready" &&
    order.preparationStatus !== "picked_up"
  ) {
    await db
      .update(orders)
      .set({ preparationStatus: "ready", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  } else if (!allItemsPrepared && order.preparationStatus === "ready") {
    await db
      .update(orders)
      .set({ preparationStatus: "in_preparation", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  } else if (isPrepared && order.preparationStatus === "pending") {
    await db
      .update(orders)
      .set({ preparationStatus: "in_preparation", updatedAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
  }

  return getOrderById(tenantId, orderId);
}

export async function deleteOrder(tenantId: string, id: string) {
  // Restore stock before deleting order items (cascade will remove them)
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, id),
    with: {
      menuItems: true,
    },
  });

  await restoreStockForItems(tenantId, items);

  // Push stock updates for affected products
  const affectedProductIds = new Set(items.map((i) => i.productId));
  for (const pid of affectedProductIds) {
    wcService.pushStock(tenantId, pid).catch(() => {});
  }

  const [deleted] = await db
    .delete(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .returning({ id: orders.id });

  return deleted;
}
