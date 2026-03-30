import {
  type CreateVariant,
  productVariants,
  type UpdateVariant,
  type UpsertVariants,
} from "@prepareos/data";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import * as wcService from "./woocommerce.service.js";

export async function listVariants(tenantId: string, productId: string) {
  return db.query.productVariants.findMany({
    where: and(
      eq(productVariants.tenantId, tenantId),
      eq(productVariants.productId, productId),
    ),
    orderBy: [asc(productVariants.sortOrder), asc(productVariants.name)],
  });
}

export async function getVariantById(tenantId: string, id: string) {
  return db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.id, id),
      eq(productVariants.tenantId, tenantId),
    ),
  });
}

export async function createVariant(
  tenantId: string,
  productId: string,
  data: CreateVariant,
) {
  const [variant] = await db
    .insert(productVariants)
    .values({
      ...data,
      stock: data.stock != null ? String(data.stock) : null,
      productId,
      tenantId,
    })
    .returning();
  wcService.pushVariant(tenantId, variant.id).catch(() => {});
  return variant;
}

export async function updateVariant(
  tenantId: string,
  id: string,
  data: UpdateVariant,
) {
  const updateData: Partial<typeof productVariants.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.stock !== undefined)
    updateData.stock = data.stock != null ? String(data.stock) : null;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [variant] = await db
    .update(productVariants)
    .set(updateData)
    .where(
      and(eq(productVariants.id, id), eq(productVariants.tenantId, tenantId)),
    )
    .returning();
  wcService.pushVariant(tenantId, id).catch(() => {});
  return variant;
}

export async function deleteVariant(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(productVariants)
    .where(
      and(eq(productVariants.id, id), eq(productVariants.tenantId, tenantId)),
    )
    .returning({ id: productVariants.id });
  return deleted;
}

/**
 * Bulk upsert: sync variants for a product.
 * Wrapped in a transaction for atomicity.
 */
export async function upsertVariants(
  tenantId: string,
  productId: string,
  variants: UpsertVariants,
) {
  const result = await db.transaction(async (tx) => {
    const existing = await tx.query.productVariants.findMany({
      where: and(
        eq(productVariants.tenantId, tenantId),
        eq(productVariants.productId, productId),
      ),
    });
    const incomingIds = new Set(variants.filter((v) => v.id).map((v) => v.id));

    // Delete variants not in incoming list
    for (const ev of existing) {
      if (!incomingIds.has(ev.id)) {
        await tx
          .delete(productVariants)
          .where(
            and(
              eq(productVariants.id, ev.id),
              eq(productVariants.tenantId, tenantId),
            ),
          );
      }
    }

    // Upsert
    const results = [];
    for (const v of variants) {
      if (v.id) {
        const [updated] = await tx
          .update(productVariants)
          .set({
            name: v.name,
            price: v.price,
            stock: v.stock != null ? String(v.stock) : null,
            isActive: v.isActive,
            sortOrder: v.sortOrder,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productVariants.id, v.id),
              eq(productVariants.tenantId, tenantId),
            ),
          )
          .returning();
        results.push(updated);
      } else {
        const [created] = await tx
          .insert(productVariants)
          .values({
            name: v.name,
            price: v.price,
            stock: v.stock != null ? String(v.stock) : null,
            isActive: v.isActive,
            sortOrder: v.sortOrder,
            productId,
            tenantId,
          })
          .returning();
        results.push(created);
      }
    }

    return results;
  });

  for (const v of result) {
    if (v?.id) wcService.pushVariant(tenantId, v.id).catch(() => {});
  }

  return result;
}

