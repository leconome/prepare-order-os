import { eq, and, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  pointsOfSale,
  orders,
  type CreatePointOfSale,
  type UpdatePointOfSale,
  type PointOfSaleFilters,
} from "@prepareos/data";

export async function listPointsOfSale(tenantId: string, filters: PointOfSaleFilters) {
  const { type, isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(pointsOfSale.tenantId, tenantId)];

  if (type !== undefined) {
    conditions.push(eq(pointsOfSale.type, type));
  }

  if (isActive !== undefined) {
    conditions.push(eq(pointsOfSale.isActive, isActive));
  }

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.query.pointsOfSale.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [asc(pointsOfSale.sortOrder), asc(pointsOfSale.name)],
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(pointsOfSale)
      .where(whereClause),
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

export async function getPointOfSaleById(tenantId: string, id: string) {
  return db.query.pointsOfSale.findFirst({
    where: and(eq(pointsOfSale.id, id), eq(pointsOfSale.tenantId, tenantId)),
  });
}

export async function createPointOfSale(tenantId: string, data: CreatePointOfSale) {
  const [pos] = await db
    .insert(pointsOfSale)
    .values({
      name: data.name,
      description: data.description ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      type: data.type,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  return getPointOfSaleById(tenantId, pos.id);
}

export async function updatePointOfSale(tenantId: string, id: string, data: UpdatePointOfSale) {
  const updateData: Partial<typeof pointsOfSale.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db
    .update(pointsOfSale)
    .set(updateData)
    .where(and(eq(pointsOfSale.id, id), eq(pointsOfSale.tenantId, tenantId)));

  return getPointOfSaleById(tenantId, id);
}

export async function countOrdersByPointOfSale(tenantId: string, posId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.posId, posId), eq(orders.tenantId, tenantId)));

  return Number(result[0]?.count ?? 0);
}

export async function deletePointOfSale(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(pointsOfSale)
    .where(and(eq(pointsOfSale.id, id), eq(pointsOfSale.tenantId, tenantId)))
    .returning({ id: pointsOfSale.id });

  return deleted;
}
