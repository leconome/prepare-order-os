import { eq, and, isNull, ilike, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  categories,
  products,
  type CreateCategory,
  type UpdateCategory,
  type CategoryFilters,
} from "@prepareos/data";
import * as wcService from "./woocommerce.service.js";

export async function listCategories(tenantId: string, filters: CategoryFilters) {
  const { search, parentId, isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(categories.tenantId, tenantId)];

  if (search) {
    conditions.push(ilike(categories.name, `%${search}%`));
  }

  if (parentId === null) {
    conditions.push(isNull(categories.parentId));
  } else if (parentId) {
    conditions.push(eq(categories.parentId, parentId));
  }

  if (isActive !== undefined) {
    conditions.push(eq(categories.isActive, isActive));
  }

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.query.categories.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [asc(categories.sortOrder), asc(categories.name)],
      with: {
        children: {
          orderBy: [asc(categories.sortOrder), asc(categories.name)],
        },
      },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(categories)
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

export async function getCategoryById(tenantId: string, id: string) {
  return db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.tenantId, tenantId)),
    with: {
      parent: {
        columns: {
          id: true,
          name: true,
        },
      },
      children: {
        orderBy: [asc(categories.sortOrder), asc(categories.name)],
      },
    },
  });
}

export async function createCategory(tenantId: string, data: CreateCategory) {
  const [category] = await db
    .insert(categories)
    .values({
      name: data.name,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      imageUrl: data.imageUrl ?? null,
      color: data.color ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  const created = await getCategoryById(tenantId, category.id);
  wcService.pushCategory(tenantId, category.id).catch(() => {});
  return created;
}

export async function updateCategory(tenantId: string, id: string, data: UpdateCategory) {
  const updateData: Partial<typeof categories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db
    .update(categories)
    .set(updateData)
    .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));

  const updated = await getCategoryById(tenantId, id);
  wcService.pushCategory(tenantId, id).catch(() => {});
  return updated;
}

export async function countProductsByCategory(tenantId: string, categoryId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.categoryId, categoryId), eq(products.tenantId, tenantId)));

  return Number(result[0]?.count ?? 0);
}

export async function deleteCategory(tenantId: string, id: string) {
  wcService.deleteRemoteCategory(tenantId, id).catch(() => {});

  // Detach products from this category before deleting
  await db
    .update(products)
    .set({ categoryId: null })
    .where(and(eq(products.categoryId, id), eq(products.tenantId, tenantId)));

  const [deleted] = await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
    .returning({ id: categories.id });

  return deleted;
}

export async function getCategoryTree(tenantId: string) {
  const rootCategories = await db.query.categories.findMany({
    where: and(isNull(categories.parentId), eq(categories.tenantId, tenantId)),
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
    with: {
      children: {
        orderBy: [asc(categories.sortOrder), asc(categories.name)],
        with: {
          children: {
            orderBy: [asc(categories.sortOrder), asc(categories.name)],
          },
        },
      },
    },
  });

  return rootCategories;
}
