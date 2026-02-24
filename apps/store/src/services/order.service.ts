import {
  clients,
  type CreateOrder,
  type CreateOrderItem,
  type OrderFilters,
  orderItems,
  orderMenuItems,
  orders,
  products,
  type UpdateOrder,
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
import { db, type Database } from "../db/index.js";
import { getMenuById } from "./menu.service.js";
import { generateTicketNumber } from "./ticket.service.js";

type TxOrDb = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Restore stock for a list of order items (regular + menu sub-items).
 * Accepts an optional transaction handle.
 */
async function restoreStockForItems(
  tenantId: string,
  items: {
    productId: string;
    quantity: number;
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
            stock: sql`${products.stock} + ${menuItem.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, menuItem.productId),
              eq(products.tenantId, tenantId),
              isNotNull(products.stock),
            ),
          );
      }
    } else {
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, item.productId),
            eq(products.tenantId, tenantId),
            isNotNull(products.stock),
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
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: totalPrice.toFixed(2),
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
        isMenu: true,
        notes: menuReq.notes ?? null,
        menuProducts: menu.products.map((mp) => ({
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
        orderId,
      })),
    );

    for (const item of regularItemsToInsert) {
      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(products.id, item.productId),
            eq(products.tenantId, tenantId),
            isNotNull(products.stock),
          ),
        );
    }
  }

  // Insert menu items + their sub-items
  for (const menuItem of menuItemsToInsert) {
    const { menuProducts: menuProds, ...itemData } = menuItem;
    const [insertedItem] = await tx
      .insert(orderItems)
      .values({ ...itemData, orderId })
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
        await tx
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
            ),
          );
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
    fromDate,
    toDate,
    page = 1,
    limit = 20,
  } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(orders.tenantId, tenantId)];

  if (search) {
    const pattern = `%${search}%`;
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

  if (pickupDate) {
    const startOfDay = new Date(pickupDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(pickupDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(gte(orders.pickupDate, startOfDay));
    conditions.push(lte(orders.pickupDate, endOfDay));
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

  const taxRate = 0.2; // 20% VAT
  const taxTotal = subtotal * taxRate;
  const total = subtotal + taxTotal;

  await db
    .update(orders)
    .set({
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
    })
    .where(eq(orders.id, order.id));

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
  if (data.assignedToId !== undefined)
    updateData.assignedToId = data.assignedToId;
  if (data.smsNotifiedAt !== undefined)
    updateData.smsNotifiedAt = data.smsNotifiedAt;

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

      // 5. Recalculate totals
      const taxRate = 0.2;
      const taxTotal = subtotal * taxRate;
      const total = subtotal + taxTotal;

      // 6. Auto-reset preparation status since items changed
      updateData.preparationStatus = "pending";
      updateData.subtotal = subtotal.toFixed(2);
      updateData.taxTotal = taxTotal.toFixed(2);
      updateData.total = total.toFixed(2);

      await tx
        .update(orders)
        .set(updateData)
        .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
    });
  } else {
    // Metadata-only update (no item changes)
    await db
      .update(orders)
      .set(updateData)
      .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));
  }

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

  // Auto-transition: if order is "pending" and we just prepared an item, move to "in_preparation"
  if (isPrepared && order.preparationStatus === "pending") {
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

  const allPrepared = allMenuItems.every((mi) => mi.isPrepared);
  await db
    .update(orderItems)
    .set({ isPrepared: allPrepared, updatedAt: new Date() })
    .where(eq(orderItems.id, parentItemId));

  // Auto-transition: if order is "pending" and we just prepared an item, move to "in_preparation"
  if (isPrepared && order.preparationStatus === "pending") {
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

  const [deleted] = await db
    .delete(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .returning({ id: orders.id });

  return deleted;
}
