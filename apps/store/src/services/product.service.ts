import {
  type CreateProduct,
  type ProductFilters,
  products,
  productVariants,
  type UpdateProduct,
} from "@prepareos/data";
import { and, asc, eq, ilike, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";

export async function listProducts(tenantId: string, filters: ProductFilters) {
  const {
    categoryId,
    isActive,
    search,
    maxStock,
    page = 1,
    limit = 20,
  } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(products.tenantId, tenantId)];

  if (categoryId) {
    conditions.push(eq(products.categoryId, categoryId));
  }

  if (isActive !== undefined) {
    conditions.push(eq(products.isActive, isActive));
  }

  if (search) {
    conditions.push(ilike(products.name, `%${search}%`));
  }

  if (maxStock !== undefined) {
    conditions.push(isNotNull(products.stock));
    conditions.push(lte(products.stock, String(maxStock)));
  }

  const whereClause = and(...conditions);

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
        variants: {
          orderBy: [asc(productVariants.sortOrder), asc(productVariants.name)],
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

export async function getProductById(tenantId: string, id: string) {
  return db.query.products.findFirst({
    where: and(eq(products.id, id), eq(products.tenantId, tenantId)),
    with: {
      category: {
        columns: {
          id: true,
          name: true,
        },
      },
      variants: {
        orderBy: [asc(productVariants.sortOrder), asc(productVariants.name)],
      },
    },
  });
}

export async function createProduct(tenantId: string, data: CreateProduct) {
  const [product] = await db
    .insert(products)
    .values({
      name: data.name,
      shortDescription: data.shortDescription ?? null,
      description: data.description ?? null,
      price: data.price,
      categoryId: data.categoryId ?? null,
      imageUrl: data.imageUrl ?? null,
      galleryUrls: data.galleryUrls ?? [],
      stock: data.stock != null ? String(data.stock) : null,
      unitType: data.unitType ?? "piece",
      defaultQty: data.defaultQty != null ? String(data.defaultQty) : null,
      hasVariants: data.hasVariants ?? false,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  return getProductById(tenantId, product.id);
}

export async function updateProduct(
  tenantId: string,
  id: string,
  data: UpdateProduct,
) {
  const updateData: Partial<typeof products.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.galleryUrls !== undefined) updateData.galleryUrls = data.galleryUrls;
  if (data.stock !== undefined)
    updateData.stock = data.stock != null ? String(data.stock) : null;
  if (data.unitType !== undefined) updateData.unitType = data.unitType;
  if (data.defaultQty !== undefined)
    updateData.defaultQty =
      data.defaultQty != null ? String(data.defaultQty) : null;
  if (data.hasVariants !== undefined) updateData.hasVariants = data.hasVariants;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db
    .update(products)
    .set(updateData)
    .where(and(eq(products.id, id), eq(products.tenantId, tenantId)));

  return getProductById(tenantId, id);
}

export async function deleteProduct(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.tenantId, tenantId)))
    .returning({ id: products.id });

  return deleted;
}
