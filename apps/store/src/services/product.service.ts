import { eq, and, ilike, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  products,
  type CreateProduct,
  type UpdateProduct,
  type ProductFilters,
} from "@prepareos/data";

export async function listProducts(filters: ProductFilters) {
  const { categoryId, isActive, search, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  if (isActive !== undefined) {
    conditions.push(eq(products.isActive, isActive));
  }

  if (search) {
    conditions.push(ilike(products.name, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [data, countResult] = await Promise.all([
    db.query.products.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [asc(products.sortOrder), asc(products.name)],
      with: {
        category: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(products)
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

export async function getProductById(id: string) {
  return db.query.products.findFirst({
    where: eq(products.id, id),
    with: {
      category: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function createProduct(data: CreateProduct) {
  const [product] = await db
    .insert(products)
    .values({
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      categoryId: data.categoryId ?? null,
      imageUrl: data.imageUrl ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();

  return getProductById(product.id);
}

export async function updateProduct(id: string, data: UpdateProduct) {
  const updateData: Partial<typeof products.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db.update(products).set(updateData).where(eq(products.id, id));

  return getProductById(id);
}

export async function deleteProduct(id: string) {
  const [deleted] = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id });

  return deleted;
}
