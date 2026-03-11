import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  productAttributes,
  attributeTerms,
  products,
  type CreateAttribute,
  type UpdateAttribute,
  type CreateTerm,
  type UpdateTerm,
} from "@prepareos/data";

// ── Attributes ──

export async function listAttributes(tenantId: string) {
  return db.query.productAttributes.findMany({
    where: eq(productAttributes.tenantId, tenantId),
    orderBy: [asc(productAttributes.sortOrder), asc(productAttributes.name)],
    with: {
      terms: {
        orderBy: [asc(attributeTerms.sortOrder), asc(attributeTerms.name)],
      },
    },
  });
}

export async function getAttributeById(tenantId: string, id: string) {
  return db.query.productAttributes.findFirst({
    where: and(
      eq(productAttributes.id, id),
      eq(productAttributes.tenantId, tenantId),
    ),
    with: {
      terms: {
        orderBy: [asc(attributeTerms.sortOrder), asc(attributeTerms.name)],
      },
    },
  });
}

export async function createAttribute(tenantId: string, data: CreateAttribute) {
  const [attribute] = await db
    .insert(productAttributes)
    .values({
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  return getAttributeById(tenantId, attribute.id);
}

export async function updateAttribute(
  tenantId: string,
  id: string,
  data: UpdateAttribute,
) {
  const updateData: Partial<typeof productAttributes.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db
    .update(productAttributes)
    .set(updateData)
    .where(
      and(
        eq(productAttributes.id, id),
        eq(productAttributes.tenantId, tenantId),
      ),
    );

  return getAttributeById(tenantId, id);
}

export async function deleteAttribute(tenantId: string, id: string) {
  // Detach products using this attribute
  await db
    .update(products)
    .set({ attributeId: null })
    .where(
      and(eq(products.attributeId, id), eq(products.tenantId, tenantId)),
    );

  const [deleted] = await db
    .delete(productAttributes)
    .where(
      and(
        eq(productAttributes.id, id),
        eq(productAttributes.tenantId, tenantId),
      ),
    )
    .returning({ id: productAttributes.id });

  return deleted;
}

// ── Terms ──

export async function createTerm(
  tenantId: string,
  attributeId: string,
  data: CreateTerm,
) {
  const attribute = await db.query.productAttributes.findFirst({
    where: and(
      eq(productAttributes.id, attributeId),
      eq(productAttributes.tenantId, tenantId),
    ),
    columns: { id: true },
  });
  if (!attribute) return null;

  const [term] = await db
    .insert(attributeTerms)
    .values({
      attributeId,
      name: data.name,
      sortOrder: data.sortOrder ?? 0,
    })
    .returning();

  return term;
}

export async function updateTerm(
  tenantId: string,
  attributeId: string,
  termId: string,
  data: UpdateTerm,
) {
  const attribute = await db.query.productAttributes.findFirst({
    where: and(
      eq(productAttributes.id, attributeId),
      eq(productAttributes.tenantId, tenantId),
    ),
    columns: { id: true },
  });
  if (!attribute) return null;

  const updateData: Partial<typeof attributeTerms.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [updated] = await db
    .update(attributeTerms)
    .set(updateData)
    .where(
      and(
        eq(attributeTerms.id, termId),
        eq(attributeTerms.attributeId, attributeId),
      ),
    )
    .returning();

  return updated ?? null;
}

export async function deleteTerm(
  tenantId: string,
  attributeId: string,
  termId: string,
) {
  const attribute = await db.query.productAttributes.findFirst({
    where: and(
      eq(productAttributes.id, attributeId),
      eq(productAttributes.tenantId, tenantId),
    ),
    columns: { id: true },
  });
  if (!attribute) return null;

  const [deleted] = await db
    .delete(attributeTerms)
    .where(
      and(
        eq(attributeTerms.id, termId),
        eq(attributeTerms.attributeId, attributeId),
      ),
    )
    .returning({ id: attributeTerms.id });

  return deleted ?? null;
}
