import { eq, and, isNull, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories } from "../db/schema/index.js";
import type { CreateCategory, UpdateCategory, CategoryFilters } from "@repo/store-types";

export async function listCategories(filters: CategoryFilters) {
  const { parentId, isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (parentId === null) {
    conditions.push(isNull(categories.parentId));
  } else if (parentId) {
    conditions.push(eq(categories.parentId, parentId));
  }

  if (isActive !== undefined) {
    conditions.push(eq(categories.isActive, isActive));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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

export async function getCategoryById(id: string) {
  return db.query.categories.findFirst({
    where: eq(categories.id, id),
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

export async function createCategory(data: CreateCategory) {
  const [category] = await db
    .insert(categories)
    .values({
      name: data.name,
      description: data.description ?? null,
      parentId: data.parentId ?? null,
      imageUrl: data.imageUrl ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();

  return getCategoryById(category.id);
}

export async function updateCategory(id: string, data: UpdateCategory) {
  const updateData: Partial<typeof categories.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db.update(categories).set(updateData).where(eq(categories.id, id));

  return getCategoryById(id);
}

export async function deleteCategory(id: string) {
  const [deleted] = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id });

  return deleted;
}

export async function getCategoryTree() {
  const rootCategories = await db.query.categories.findMany({
    where: isNull(categories.parentId),
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
