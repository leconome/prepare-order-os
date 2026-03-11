import { eq, and, ilike, sql, asc, lte, isNotNull } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  products,
  productVariants,
  type CreateProduct,
  type UpdateProduct,
  type ProductFilters,
  type CreateVariant,
  type UpdateVariant,
} from "@prepareos/data";

export async function listProducts(tenantId: string, filters: ProductFilters) {
  const { categoryId, isActive, search, maxStock, page = 1, limit = 20 } = filters;
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
        attribute: {
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
      attribute: {
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
      description: data.description ?? null,
      price: data.price,
      categoryId: data.categoryId ?? null,
      imageUrl: data.imageUrl ?? null,
      stock: data.stock != null ? String(data.stock) : null,
      unitType: data.unitType ?? "piece",
      defaultQty: data.defaultQty != null ? String(data.defaultQty) : null,
      stockMode: data.stockMode ?? null,
      attributeId: data.attributeId ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  return getProductById(tenantId, product.id);
}

export async function updateProduct(tenantId: string, id: string, data: UpdateProduct) {
  const updateData: Partial<typeof products.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.stock !== undefined) updateData.stock = data.stock != null ? String(data.stock) : null;
  if (data.unitType !== undefined) updateData.unitType = data.unitType;
  if (data.defaultQty !== undefined) updateData.defaultQty = data.defaultQty != null ? String(data.defaultQty) : null;
  if (data.stockMode !== undefined) updateData.stockMode = data.stockMode;
  if (data.attributeId !== undefined) updateData.attributeId = data.attributeId;
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

// ── Variant CRUD ──

export async function listVariants(tenantId: string, productId: string) {
  // Verify product belongs to tenant
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
    columns: { id: true },
  });
  if (!product) return null;

  return db.query.productVariants.findMany({
    where: eq(productVariants.productId, productId),
    orderBy: [asc(productVariants.sortOrder), asc(productVariants.name)],
  });
}

export async function createVariant(tenantId: string, productId: string, data: CreateVariant) {
  // Verify product belongs to tenant
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
    columns: { id: true },
  });
  if (!product) return null;

  const [variant] = await db
    .insert(productVariants)
    .values({
      productId,
      attributeTermId: data.attributeTermId ?? null,
      name: data.name,
      price: data.price,
      stock: data.stock != null ? String(data.stock) : null,
      capacity: data.capacity != null ? String(data.capacity) : "1",
      sortOrder: data.sortOrder ?? 0,
      isActive: data.isActive ?? true,
    })
    .returning();

  return variant;
}

export async function updateVariant(
  tenantId: string,
  productId: string,
  variantId: string,
  data: UpdateVariant,
) {
  // Verify product belongs to tenant
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
    columns: { id: true },
  });
  if (!product) return null;

  const updateData: Partial<typeof productVariants.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.stock !== undefined) updateData.stock = data.stock != null ? String(data.stock) : null;
  if (data.capacity !== undefined) updateData.capacity = String(data.capacity);
  if (data.attributeTermId !== undefined) updateData.attributeTermId = data.attributeTermId;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const [updated] = await db
    .update(productVariants)
    .set(updateData)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .returning();

  return updated ?? null;
}

export async function deleteVariant(tenantId: string, productId: string, variantId: string) {
  // Verify product belongs to tenant
  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
    columns: { id: true },
  });
  if (!product) return null;

  const [deleted] = await db
    .delete(productVariants)
    .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)))
    .returning({ id: productVariants.id });

  return deleted ?? null;
}
