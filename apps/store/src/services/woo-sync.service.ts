import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  categories,
  tenants,
  products,
  productVariants,
  productAttributes,
  attributeTerms,
} from "@prepareos/data";

interface WooSyncResult {
  created: number;
  updated: number;
}

/**
 * Push PrepareOS categories to a connected WooCommerce site.
 * Calls POST {wooUrl}/wp-json/prepareos/v1/sync/categories
 */
export async function pushCategoriesToWoo(
  tenantId: string,
): Promise<WooSyncResult> {
  // 1. Get tenant to find wooUrl and apiKey
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant?.wooUrl) {
    throw new Error("Aucune boutique WooCommerce connectée.");
  }

  if (!tenant.apiKey) {
    throw new Error("Aucune clé API configurée.");
  }

  // 2. Fetch all active categories for this tenant
  const allCategories = await db.query.categories.findMany({
    where: and(eq(categories.tenantId, tenantId), eq(categories.isActive, true)),
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  });

  if (allCategories.length === 0) {
    return { created: 0, updated: 0 };
  }

  // 3. Format for WordPress endpoint
  const payload = allCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description || "",
    parentId: cat.parentId,
    imageUrl: cat.imageUrl,
  }));

  // 4. Call WordPress REST API
  const url = `${tenant.wooUrl.replace(/\/$/, "")}/wp-json/prepareos/v1/sync/categories`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tenant.apiKey}`,
    },
    body: JSON.stringify({ categories: payload }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WooCommerce a répondu ${response.status}: ${text}`);
  }

  const result = (await response.json()) as {
    ok: boolean;
    created: number;
    updated: number;
  };

  return { created: result.created, updated: result.updated };
}

/**
 * Push PrepareOS attributes (with terms) to a connected WooCommerce site.
 * Calls POST {wooUrl}/wp-json/prepareos/v1/sync/attributes
 */
export async function pushAttributesToWoo(
  tenantId: string,
): Promise<WooSyncResult> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant?.wooUrl) {
    throw new Error("Aucune boutique WooCommerce connectée.");
  }
  if (!tenant.apiKey) {
    throw new Error("Aucune clé API configurée.");
  }

  // Fetch all attributes with their terms
  const allAttributes = await db.query.productAttributes.findMany({
    where: eq(productAttributes.tenantId, tenantId),
    orderBy: [asc(productAttributes.sortOrder), asc(productAttributes.name)],
    with: {
      terms: {
        orderBy: [asc(attributeTerms.sortOrder), asc(attributeTerms.name)],
      },
    },
  });

  if (allAttributes.length === 0) {
    return { created: 0, updated: 0 };
  }

  const payload = allAttributes.map((attr) => ({
    id: attr.id,
    name: attr.name,
    wooId: attr.wooId,
    terms: attr.terms.map((term) => ({
      id: term.id,
      name: term.name,
      wooId: term.wooId,
    })),
  }));

  const url = `${tenant.wooUrl.replace(/\/$/, "")}/wp-json/prepareos/v1/sync/attributes`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tenant.apiKey}`,
    },
    body: JSON.stringify({ attributes: payload }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WooCommerce a répondu ${response.status}: ${text}`);
  }

  const result = (await response.json()) as {
    ok: boolean;
    created: number;
    updated: number;
    mapping?: Array<{ id: string; wooId: number; terms?: Array<{ id: string; wooId: number }> }>;
  };

  // Save wooId mapping back to our DB
  if (result.mapping) {
    for (const item of result.mapping) {
      await db
        .update(productAttributes)
        .set({ wooId: item.wooId, updatedAt: new Date() })
        .where(eq(productAttributes.id, item.id));

      if (item.terms) {
        for (const term of item.terms) {
          await db
            .update(attributeTerms)
            .set({ wooId: term.wooId, updatedAt: new Date() })
            .where(eq(attributeTerms.id, term.id));
        }
      }
    }
  }

  return { created: result.created, updated: result.updated };
}

/**
 * Push PrepareOS products (with variants) to a connected WooCommerce site.
 * Calls POST {wooUrl}/wp-json/prepareos/v1/sync/products
 */
export async function pushProductsToWoo(
  tenantId: string,
): Promise<WooSyncResult> {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant?.wooUrl) {
    throw new Error("Aucune boutique WooCommerce connectée.");
  }
  if (!tenant.apiKey) {
    throw new Error("Aucune clé API configurée.");
  }

  // Fetch all active products with category, variants, and attribute
  const allProducts = await db.query.products.findMany({
    where: and(eq(products.tenantId, tenantId), eq(products.isActive, true)),
    orderBy: [asc(products.sortOrder), asc(products.name)],
    with: {
      category: true,
      attribute: true,
      variants: {
        where: eq(productVariants.isActive, true),
        orderBy: [asc(productVariants.sortOrder), asc(productVariants.name)],
        with: {
          attributeTerm: true,
        },
      },
    },
  });

  if (allProducts.length === 0) {
    return { created: 0, updated: 0 };
  }

  const payload = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description || "",
    price: p.price,
    categoryWooId: p.category?.wooId ?? null,
    imageUrl: p.imageUrl,
    stock: p.stock ? Number(p.stock) : null,
    unitType: p.unitType,
    wooId: p.wooId,
    attributeWooId: p.attribute?.wooId ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      stock: v.stock ? Number(v.stock) : null,
      capacity: v.capacity ? Number(v.capacity) : 1,
      attributeTermWooId: v.attributeTerm?.wooId ?? null,
    })),
  }));

  const url = `${tenant.wooUrl.replace(/\/$/, "")}/wp-json/prepareos/v1/sync/products`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tenant.apiKey}`,
    },
    body: JSON.stringify({ products: payload }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`WooCommerce a répondu ${response.status}: ${text}`);
  }

  const result = (await response.json()) as {
    ok: boolean;
    created: number;
    updated: number;
    mapping?: Array<{ id: string; wooId: number }>;
  };

  // Save wooId mapping back to our DB
  if (result.mapping) {
    for (const item of result.mapping) {
      await db
        .update(products)
        .set({ wooId: item.wooId, updatedAt: new Date() })
        .where(eq(products.id, item.id));
    }
  }

  return { created: result.created, updated: result.updated };
}
