import { eq, and, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories, tenants } from "@prepareos/data";

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
