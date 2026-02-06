import { eq, and, gte, lte, sql, desc, isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  orders,
  orderItems,
  products,
  type CreateOrder,
  type UpdateOrder,
  type UpdateOrderStatus,
  type OrderFilters,
} from "@prepareos/data";
import { generateTicketNumber } from "./ticket.service.js";

export async function listOrders(tenantId: string, filters: OrderFilters) {
  const {
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
        items: true,
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
      items: true,
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

  let subtotal = 0;
  const itemsToInsert = data.items.map((item) => {
    const totalPrice = Number(item.unitPrice) * item.quantity;
    subtotal += totalPrice;
    return {
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: totalPrice.toFixed(2),
      notes: item.notes ?? null,
    };
  });

  const taxRate = 0.2; // 20% VAT
  const taxTotal = subtotal * taxRate;
  const total = subtotal + taxTotal;

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
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: total.toFixed(2),
      tenantId,
    })
    .returning();

  if (itemsToInsert.length > 0) {
    await db.insert(orderItems).values(
      itemsToInsert.map((item) => ({
        ...item,
        orderId: order.id,
      })),
    );

    // Decrement stock for products that track inventory
    for (const item of itemsToInsert) {
      await db
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

  return getOrderById(tenantId, order.id);
}

export async function updateOrder(tenantId: string, id: string, data: UpdateOrder) {
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

  await db
    .update(orders)
    .set(updateData)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)));

  return getOrderById(tenantId, id);
}

export async function updateOrderStatus(tenantId: string, id: string, data: UpdateOrderStatus) {
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

export async function deleteOrder(tenantId: string, id: string) {
  // Restore stock before deleting order items (cascade will remove them)
  const items = await db.query.orderItems.findMany({
    where: eq(orderItems.orderId, id),
  });

  for (const item of items) {
    await db
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

  const [deleted] = await db
    .delete(orders)
    .where(and(eq(orders.id, id), eq(orders.tenantId, tenantId)))
    .returning({ id: orders.id });

  return deleted;
}
