import {
  categories,
  products,
  productVariants,
  wooCommerceConnections,
  wooCommerceIdMappings,
  wooCommerceSyncLogs,
  type ConnectWooCommerce,
} from "@prepareos/data";
import { and, desc, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { WooCommerceClient } from "../lib/woocommerce.client.js";

const BATCH_SIZE = 100;
const MAX_SYNC_LOGS = 20;

// ── Internal helpers ──────────────────────────────────

function createClient(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
): WooCommerceClient {
  return new WooCommerceClient({ storeUrl, consumerKey, consumerSecret });
}

function maskSecret(secret: string): string {
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 4)}${"*".repeat(8)}${secret.slice(-4)}`;
}

// ── Connection management ─────────────────────────────

export async function getConnection(tenantId: string) {
  const conn = await db.query.wooCommerceConnections.findFirst({
    where: eq(wooCommerceConnections.tenantId, tenantId),
  });
  if (!conn) return null;
  return {
    ...conn,
    consumerKey: maskSecret(conn.consumerKey),
    consumerSecret: maskSecret(conn.consumerSecret),
  };
}

export async function getRawConnection(tenantId: string) {
  return db.query.wooCommerceConnections.findFirst({
    where: eq(wooCommerceConnections.tenantId, tenantId),
  });
}

async function getEnabledConnection(tenantId: string) {
  const conn = await getRawConnection(tenantId);
  if (!conn || !conn.isEnabled) return null;
  return conn;
}

export async function testConnection(
  storeUrl: string,
  consumerKey: string,
  consumerSecret: string,
) {
  const client = createClient(storeUrl, consumerKey, consumerSecret);
  const status = await client.getSystemStatus();
  return {
    wcVersion: status.environment.version,
    storeName: status.settings.store_name ?? "",
  };
}

export async function connect(
  tenantId: string,
  data: ConnectWooCommerce,
  apiHost: string,
) {
  // Test connection first
  const { wcVersion, storeName } = await testConnection(
    data.storeUrl,
    data.consumerKey,
    data.consumerSecret,
  );

  const webhookSecret = crypto.randomBytes(32).toString("hex");
  const client = createClient(
    data.storeUrl,
    data.consumerKey,
    data.consumerSecret,
  );

  // Upsert connection
  const [connection] = await db
    .insert(wooCommerceConnections)
    .values({
      tenantId,
      storeUrl: data.storeUrl,
      consumerKey: data.consumerKey,
      consumerSecret: data.consumerSecret,
      webhookSecret,
      isEnabled: true,
    })
    .onConflictDoUpdate({
      target: wooCommerceConnections.tenantId,
      set: {
        storeUrl: data.storeUrl,
        consumerKey: data.consumerKey,
        consumerSecret: data.consumerSecret,
        webhookSecret,
        isEnabled: true,
        updatedAt: new Date(),
      },
    })
    .returning();

  // Register webhooks for order events
  const webhookUrl = `${apiHost}/api/webhooks/woocommerce/${tenantId}`;
  const topics = [
    "order.created",
    "order.updated",
  ];

  for (const topic of topics) {
    try {
      await client.createWebhook(topic, webhookUrl, webhookSecret);
    } catch (error) {
      console.error(`Failed to register webhook ${topic}:`, error);
    }
  }

  await logSyncEvent(
    tenantId,
    "webhook_registered",
    "success",
    `Connected to ${storeName} (WC ${wcVersion})`,
  );

  await logSyncEvent(
    tenantId,
    "connection_test",
    "success",
    `Connection verified: ${storeName} (WC ${wcVersion})`,
  );

  return {
    ...connection,
    consumerKey: maskSecret(connection.consumerKey),
    consumerSecret: maskSecret(connection.consumerSecret),
  };
}

export async function disconnect(tenantId: string) {
  const conn = await getRawConnection(tenantId);
  if (!conn) return;

  // Try to delete webhooks from WC
  try {
    const client = createClient(
      conn.storeUrl,
      conn.consumerKey,
      conn.consumerSecret,
    );
    const webhooks = await client.listWebhooks();
    for (const wh of webhooks) {
      if (wh.delivery_url.includes(tenantId)) {
        await client.deleteWebhook(wh.id);
      }
    }
  } catch {
    // Best-effort: WC may be unreachable
  }

  await db
    .delete(wooCommerceConnections)
    .where(eq(wooCommerceConnections.tenantId, tenantId));

  // Clean up mappings and logs
  await db
    .delete(wooCommerceIdMappings)
    .where(eq(wooCommerceIdMappings.tenantId, tenantId));
  await db
    .delete(wooCommerceSyncLogs)
    .where(eq(wooCommerceSyncLogs.tenantId, tenantId));
}

export async function toggleConnection(tenantId: string, isEnabled: boolean) {
  const [updated] = await db
    .update(wooCommerceConnections)
    .set({ isEnabled, updatedAt: new Date() })
    .where(eq(wooCommerceConnections.tenantId, tenantId))
    .returning();
  if (!updated) return null;
  return {
    ...updated,
    consumerKey: maskSecret(updated.consumerKey),
    consumerSecret: maskSecret(updated.consumerSecret),
  };
}

// ── Health ────────────────────────────────────────────

export async function getHealth(tenantId: string) {
  const conn = await getRawConnection(tenantId);
  if (!conn) return null;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );

  try {
    console.log(`[WC Health] Checking ${conn.storeUrl} for tenant ${tenantId}`);
    const status = await client.getSystemStatus();
    console.log(`[WC Health] System status OK — WC ${status.environment.version}`);

    const webhooks = await client.listWebhooks();
    const tenantWebhooks = webhooks.filter((wh) =>
      wh.delivery_url.includes(tenantId),
    );
    console.log(`[WC Health] Found ${tenantWebhooks.length} webhook(s) for tenant`);

    await db
      .update(wooCommerceConnections)
      .set({ lastHealthCheckAt: new Date(), updatedAt: new Date() })
      .where(eq(wooCommerceConnections.tenantId, tenantId));

    return {
      connected: true,
      wcVersion: status.environment.version,
      storeName: status.settings.store_name ?? "",
      webhooks: tenantWebhooks.map((wh) => ({
        id: wh.id,
        topic: wh.topic,
        status: wh.status,
      })),
    };
  } catch (error) {
    console.error(`[WC Health] Failed for tenant ${tenantId}:`, error);
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
      webhooks: [],
    };
  }
}

// ── Field mapping helpers ─────────────────────────────

function mapProductToWc(
  product: typeof products.$inferSelect,
  tenantId: string,
) {
  const data: Record<string, unknown> = {
    name: product.name,
    short_description: product.shortDescription ?? "",
    description: product.description ?? "",
    regular_price: product.price,
    type: product.hasVariants ? "variable" : "simple",
    status: product.isActive ? "publish" : "draft",
    manage_stock: !product.hasVariants,
    stock_quantity: product.stock ? Number(product.stock) : null,
    meta_data: [
      { key: "_prepareos_unit_type", value: product.unitType },
    ],
  };

  // Only include images in production — in dev, WooCommerce can't reach local S3 URLs
  if (process.env.NODE_ENV === "production") {
    const images: { src: string }[] = [];
    if (product.imageUrl) {
      images.push({ src: product.imageUrl });
    }
    const galleryUrls = product.galleryUrls as string[] | null;
    if (galleryUrls?.length) {
      for (const url of galleryUrls) {
        images.push({ src: url });
      }
    }
    if (images.length > 0) {
      data.images = images;
    }
  }

  return data;
}

function mapCategoryToWc(category: typeof categories.$inferSelect, _tenantId: string) {
  const data: Record<string, unknown> = {
    name: category.name,
    description: category.description ?? "",
  };
  if (category.imageUrl) {
    data.image = { src: category.imageUrl };
  }
  return data;
}

function mapVariantToWc(variant: typeof productVariants.$inferSelect) {
  return {
    regular_price: variant.price,
    status: variant.isActive ? "publish" : "private",
    manage_stock: true,
    stock_quantity: variant.stock ? Number(variant.stock) : null,
    attributes: [{ name: "Option", option: variant.name }],
  };
}

// ── Push operations ───────────────────────────────────

export async function pushProduct(tenantId: string, productId: string) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) return;

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
  });
  if (!product) return;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );
  const wcData = mapProductToWc(product, tenantId);

  // Look up category mapping if product has a category
  if (product.categoryId) {
    const catMapping = await getMapping(tenantId, "category", product.categoryId);
    if (catMapping) {
      (wcData as Record<string, unknown>).categories = [
        { id: catMapping.remoteId },
      ];
    }
  }

  try {
    const existing = await getMapping(tenantId, "product", productId);

    if (existing) {
      try {
        const result = await client.updateProduct(existing.remoteId, wcData);
        await upsertMapping(tenantId, "product", productId, result.id);
      } catch (error) {
        // 404 means deleted in WC — recreate
        if (error instanceof Error && error.message.includes("404")) {
          const result = await client.createProduct(wcData);
          await upsertMapping(tenantId, "product", productId, result.id);
        } else {
          throw error;
        }
      }
    } else {
      const result = await client.createProduct(wcData);
      await upsertMapping(tenantId, "product", productId, result.id);
    }

    await updateLastSyncAt(tenantId);
    await logSyncEvent(
      tenantId,
      "product_push",
      "success",
      `Pushed product "${product.name}"`,
    );
  } catch (error) {
    await logSyncEvent(
      tenantId,
      "product_push",
      "failure",
      `Failed to push product "${product.name}"`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function pushCategory(tenantId: string, categoryId: string) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) return;

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, categoryId),
      eq(categories.tenantId, tenantId),
    ),
  });
  if (!category) return;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );
  const wcData = mapCategoryToWc(category, tenantId);

  // Map parent category if exists
  if (category.parentId) {
    const parentMapping = await getMapping(tenantId, "category", category.parentId);
    if (parentMapping) {
      wcData.parent = parentMapping.remoteId;
    }
  }

  try {
    const existing = await getMapping(tenantId, "category", categoryId);

    if (existing) {
      try {
        const result = await client.updateCategory(existing.remoteId, wcData);
        await upsertMapping(tenantId, "category", categoryId, result.id);
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          const result = await client.createCategory(wcData);
          await upsertMapping(tenantId, "category", categoryId, result.id);
        } else {
          throw error;
        }
      }
    } else {
      const result = await client.createCategory(wcData);
      await upsertMapping(tenantId, "category", categoryId, result.id);
    }

    await updateLastSyncAt(tenantId);
    await logSyncEvent(
      tenantId,
      "category_push",
      "success",
      `Pushed category "${category.name}"`,
    );
  } catch (error) {
    await logSyncEvent(
      tenantId,
      "category_push",
      "failure",
      `Failed to push category "${category.name}"`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function pushVariant(tenantId: string, variantId: string) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) return;

  const variant = await db.query.productVariants.findFirst({
    where: and(
      eq(productVariants.id, variantId),
      eq(productVariants.tenantId, tenantId),
    ),
  });
  if (!variant) return;

  // Need the parent product's WC ID
  const parentMapping = await getMapping(tenantId, "product", variant.productId);
  if (!parentMapping) return;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );
  const wcData = mapVariantToWc(variant);

  try {
    const existing = await getMapping(tenantId, "product_variant", variantId);

    if (existing) {
      try {
        const result = await client.updateVariation(
          parentMapping.remoteId,
          existing.remoteId,
          wcData,
        );
        await upsertMapping(tenantId, "product_variant", variantId, result.id);
      } catch (error) {
        if (error instanceof Error && error.message.includes("404")) {
          const result = await client.createVariation(
            parentMapping.remoteId,
            wcData,
          );
          await upsertMapping(
            tenantId,
            "product_variant",
            variantId,
            result.id,
          );
        } else {
          throw error;
        }
      }
    } else {
      const result = await client.createVariation(
        parentMapping.remoteId,
        wcData,
      );
      await upsertMapping(tenantId, "product_variant", variantId, result.id);
    }

    await updateLastSyncAt(tenantId);
    await logSyncEvent(
      tenantId,
      "variant_push",
      "success",
      `Pushed variant "${variant.name}"`,
    );
  } catch (error) {
    await logSyncEvent(
      tenantId,
      "variant_push",
      "failure",
      `Failed to push variant "${variant.name}"`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function pushStock(tenantId: string, productId: string) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) return;

  const product = await db.query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
  });
  if (!product) return;

  const mapping = await getMapping(tenantId, "product", productId);
  if (!mapping) return;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );

  try {
    await client.updateStock(
      mapping.remoteId,
      product.stock ? Number(product.stock) : null,
      !product.hasVariants,
    );

    await updateLastSyncAt(tenantId);
    await logSyncEvent(
      tenantId,
      "stock_push",
      "success",
      `Updated stock for "${product.name}": ${product.stock ?? "unmanaged"}`,
    );
  } catch (error) {
    await logSyncEvent(
      tenantId,
      "stock_push",
      "failure",
      `Failed to update stock for "${product.name}"`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function deleteRemoteProduct(
  tenantId: string,
  productId: string,
) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) return;

  const mapping = await getMapping(tenantId, "product", productId);
  if (!mapping) return;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );

  try {
    await client.deleteProduct(mapping.remoteId);
  } catch {
    // May already be deleted — that's fine
  }

  await deleteMapping(tenantId, "product", productId);
}

export async function deleteRemoteCategory(
  tenantId: string,
  categoryId: string,
) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) return;

  const mapping = await getMapping(tenantId, "category", categoryId);
  if (!mapping) return;

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );

  try {
    await client.deleteCategory(mapping.remoteId);
  } catch {
    // May already be deleted
  }

  await deleteMapping(tenantId, "category", categoryId);
}

// ── Backfill ──────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function backfill(tenantId: string) {
  const conn = await getEnabledConnection(tenantId);
  if (!conn) throw new Error("No enabled WooCommerce connection");

  const client = createClient(
    conn.storeUrl,
    conn.consumerKey,
    conn.consumerSecret,
  );

  const errors: string[] = [];
  console.log(`[WC Backfill] Starting backfill for tenant ${tenantId} → ${conn.storeUrl}`);

  // 1. Push categories (roots first, then children)
  const allCategories = await db
    .select()
    .from(categories)
    .where(eq(categories.tenantId, tenantId));

  const rootCategories = allCategories.filter((c) => !c.parentId);
  const childCategories = allCategories.filter((c) => c.parentId);

  console.log(`[WC Backfill] Found ${allCategories.length} categories (${rootCategories.length} root, ${childCategories.length} children)`);
  try {
    await backfillCategories(client, tenantId, rootCategories);
    await backfillCategories(client, tenantId, childCategories);
  } catch (e) {
    const msg = `Categories failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[WC Backfill]", msg);
    errors.push(msg);
  }

  // 2. Push products
  const allProducts = await db
    .select()
    .from(products)
    .where(eq(products.tenantId, tenantId));

  console.log(`[WC Backfill] Found ${allProducts.length} products`);
  try {
    await backfillProducts(client, tenantId, allProducts);
  } catch (e) {
    const msg = `Products failed: ${e instanceof Error ? e.message : String(e)}`;
    console.error("[WC Backfill]", msg);
    errors.push(msg);
  }

  // 3. Push variants grouped by parent product
  const allVariants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.tenantId, tenantId));

  const variantsByProduct = new Map<
    string,
    (typeof productVariants.$inferSelect)[]
  >();
  for (const v of allVariants) {
    const group = variantsByProduct.get(v.productId) ?? [];
    group.push(v);
    variantsByProduct.set(v.productId, group);
  }

  console.log(`[WC Backfill] Found ${allVariants.length} variants across ${variantsByProduct.size} products`);

  for (const [productId, variants] of variantsByProduct) {
    const productMapping = await getMapping(tenantId, "product", productId);
    if (!productMapping) continue;
    try {
      await backfillVariants(client, tenantId, productMapping.remoteId, variants);
    } catch (e) {
      const msg = `Variants for product ${productId} failed: ${e instanceof Error ? e.message : String(e)}`;
      console.error("[WC Backfill]", msg);
      errors.push(msg);
    }
  }

  await updateLastSyncAt(tenantId);

  const counts = {
    categories: allCategories.length,
    products: allProducts.length,
    variants: allVariants.length,
    errors,
  };

  if (errors.length > 0) {
    await logSyncEvent(
      tenantId,
      "backfill",
      "failure",
      `Backfill partial: ${counts.categories} categories, ${counts.products} products, ${counts.variants} variants — ${errors.length} error(s)`,
      errors.join("\n"),
    );
  } else {
    await logSyncEvent(
      tenantId,
      "backfill",
      "success",
      `Backfill complete: ${counts.categories} categories, ${counts.products} products, ${counts.variants} variants`,
    );
  }

  return counts;
}

async function backfillCategories(
  client: WooCommerceClient,
  tenantId: string,
  cats: (typeof categories.$inferSelect)[],
) {
  if (cats.length === 0) {
    console.log("[WC Backfill] No categories to process");
    return;
  }

  const toCreate: { local: typeof categories.$inferSelect; wc: Record<string, unknown> }[] = [];
  const toUpdate: { local: typeof categories.$inferSelect; wc: Record<string, unknown>; remoteId: number }[] = [];

  for (const cat of cats) {
    const wcData = mapCategoryToWc(cat, tenantId);
    if (cat.parentId) {
      const parentMapping = await getMapping(tenantId, "category", cat.parentId);
      if (parentMapping) {
        wcData.parent = parentMapping.remoteId;
      } else {
        console.warn(`[WC Backfill] Category '${cat.name}' has parentId ${cat.parentId} but no mapping found`);
      }
    }
    const existing = await getMapping(tenantId, "category", cat.id);
    if (existing) {
      toUpdate.push({ local: cat, wc: { ...wcData, id: existing.remoteId }, remoteId: existing.remoteId });
    } else {
      toCreate.push({ local: cat, wc: wcData });
    }
  }

  console.log(`[WC Backfill] Categories: ${toCreate.length} to create, ${toUpdate.length} to update`);

  for (const createChunk of chunk(toCreate, BATCH_SIZE)) {
    console.log(`[WC Backfill] Batch creating ${createChunk.length} categories...`);
    const result = await client.batchCategories({
      create: createChunk.map((c) => c.wc),
    });
    console.log("[WC Backfill] Batch categories create response:", JSON.stringify(result, null, 2));
    if (result.create) {
      for (let i = 0; i < result.create.length; i++) {
        const item = result.create[i] as Record<string, unknown>;
        if (item.error) {
          console.error(`[WC Backfill] Category '${createChunk[i].local.name}' error:`, item.error);
          continue;
        }
        await upsertMapping(tenantId, "category", createChunk[i].local.id, item.id as number);
      }
    }
  }

  for (const updateChunk of chunk(toUpdate, BATCH_SIZE)) {
    console.log(`[WC Backfill] Batch updating ${updateChunk.length} categories...`);
    const result = await client.batchCategories({
      update: updateChunk.map((u) => u.wc),
    });
    console.log("[WC Backfill] Batch categories update response:", JSON.stringify(result, null, 2));
    for (const u of updateChunk) {
      await upsertMapping(tenantId, "category", u.local.id, u.remoteId);
    }
  }
}

async function backfillProducts(
  client: WooCommerceClient,
  tenantId: string,
  prods: (typeof products.$inferSelect)[],
) {
  if (prods.length === 0) {
    console.log("[WC Backfill] No products to process");
    return;
  }

  const toCreate: { local: typeof products.$inferSelect; wc: Record<string, unknown> }[] = [];
  const toUpdate: { local: typeof products.$inferSelect; wc: Record<string, unknown>; remoteId: number }[] = [];

  for (const prod of prods) {
    const wcData: Record<string, unknown> = mapProductToWc(prod, tenantId);
    if (prod.categoryId) {
      const catMapping = await getMapping(tenantId, "category", prod.categoryId);
      if (catMapping) {
        wcData.categories = [{ id: catMapping.remoteId }];
      } else {
        console.warn(`[WC Backfill] Product '${prod.name}' has categoryId ${prod.categoryId} but no mapping found`);
      }
    }
    const existing = await getMapping(tenantId, "product", prod.id);
    if (existing) {
      toUpdate.push({ local: prod, wc: { ...wcData, id: existing.remoteId }, remoteId: existing.remoteId });
    } else {
      toCreate.push({ local: prod, wc: wcData });
    }
  }

  console.log(`[WC Backfill] Products: ${toCreate.length} to create, ${toUpdate.length} to update`);

  for (const createChunk of chunk(toCreate, BATCH_SIZE)) {
    console.log(`[WC Backfill] Batch creating ${createChunk.length} products...`);
    console.log("[WC Backfill] Product payload sample:", JSON.stringify(createChunk[0]?.wc, null, 2));
    const result = await client.batchProducts({
      create: createChunk.map((c) => c.wc),
    });
    console.log("[WC Backfill] Batch products create response:", JSON.stringify(result, null, 2));
    if (result.create) {
      for (let i = 0; i < result.create.length; i++) {
        const item = result.create[i] as Record<string, unknown>;
        if (item.error) {
          console.error(`[WC Backfill] Product '${createChunk[i].local.name}' error:`, JSON.stringify(item.error));
          continue;
        }
        await upsertMapping(tenantId, "product", createChunk[i].local.id, item.id as number);
        console.log(`[WC Backfill] Product '${createChunk[i].local.name}' → WC #${item.id}`);
      }
    } else {
      console.error("[WC Backfill] No 'create' key in batch products response");
    }
  }

  for (const updateChunk of chunk(toUpdate, BATCH_SIZE)) {
    console.log(`[WC Backfill] Batch updating ${updateChunk.length} products...`);
    const result = await client.batchProducts({
      update: updateChunk.map((u) => u.wc),
    });
    console.log("[WC Backfill] Batch products update response:", JSON.stringify(result, null, 2));
    for (const u of updateChunk) {
      await upsertMapping(tenantId, "product", u.local.id, u.remoteId);
    }
  }
}

async function backfillVariants(
  client: WooCommerceClient,
  tenantId: string,
  wcProductId: number,
  variants: (typeof productVariants.$inferSelect)[],
) {
  if (variants.length === 0) {
    console.log(`[WC Backfill] No variants for WC product #${wcProductId}`);
    return;
  }

  const toCreate: { local: typeof productVariants.$inferSelect; wc: Record<string, unknown> }[] = [];
  const toUpdate: { local: typeof productVariants.$inferSelect; wc: Record<string, unknown>; remoteId: number }[] = [];

  for (const v of variants) {
    const wcData: Record<string, unknown> = mapVariantToWc(v);
    const existing = await getMapping(tenantId, "product_variant", v.id);
    if (existing) {
      toUpdate.push({ local: v, wc: { ...wcData, id: existing.remoteId }, remoteId: existing.remoteId });
    } else {
      toCreate.push({ local: v, wc: wcData });
    }
  }

  console.log(`[WC Backfill] Variants for WC #${wcProductId}: ${toCreate.length} to create, ${toUpdate.length} to update`);

  for (const createChunk of chunk(toCreate, BATCH_SIZE)) {
    console.log(`[WC Backfill] Batch creating ${createChunk.length} variants for WC product #${wcProductId}...`);
    const result = await client.batchVariations(wcProductId, {
      create: createChunk.map((c) => c.wc),
    });
    console.log("[WC Backfill] Batch variants create response:", JSON.stringify(result, null, 2));
    if (result.create) {
      for (let i = 0; i < result.create.length; i++) {
        const item = result.create[i] as Record<string, unknown>;
        if (item.error) {
          console.error(`[WC Backfill] Variant '${createChunk[i].local.name}' error:`, JSON.stringify(item.error));
          continue;
        }
        await upsertMapping(tenantId, "product_variant", createChunk[i].local.id, item.id as number);
        console.log(`[WC Backfill] Variant '${createChunk[i].local.name}' → WC #${item.id}`);
      }
    }
  }

  for (const updateChunk of chunk(toUpdate, BATCH_SIZE)) {
    console.log(`[WC Backfill] Batch updating ${updateChunk.length} variants for WC product #${wcProductId}...`);
    const result = await client.batchVariations(wcProductId, {
      update: updateChunk.map((u) => u.wc),
    });
    console.log("[WC Backfill] Batch variants update response:", JSON.stringify(result, null, 2));
    for (const u of updateChunk) {
      await upsertMapping(tenantId, "product_variant", u.local.id, u.remoteId);
    }
  }
}

// ── Logs ──────────────────────────────────────────────

export async function getLogs(tenantId: string) {
  return db
    .select()
    .from(wooCommerceSyncLogs)
    .where(eq(wooCommerceSyncLogs.tenantId, tenantId))
    .orderBy(desc(wooCommerceSyncLogs.createdAt))
    .limit(MAX_SYNC_LOGS);
}

export async function logSyncEvent(
  tenantId: string,
  action: (typeof wooCommerceSyncLogs.$inferInsert)["action"],
  status: (typeof wooCommerceSyncLogs.$inferInsert)["status"],
  summary: string,
  details?: string,
) {
  await db.insert(wooCommerceSyncLogs).values({
    tenantId,
    action,
    status,
    summary,
    details: details ?? null,
  });

  // Prune old logs beyond MAX_SYNC_LOGS per tenant
  await db.execute(sql`
    DELETE FROM ${wooCommerceSyncLogs}
    WHERE ${wooCommerceSyncLogs.tenantId} = ${tenantId}
      AND ${wooCommerceSyncLogs.id} NOT IN (
        SELECT ${wooCommerceSyncLogs.id}
        FROM ${wooCommerceSyncLogs}
        WHERE ${wooCommerceSyncLogs.tenantId} = ${tenantId}
        ORDER BY ${wooCommerceSyncLogs.createdAt} DESC
        LIMIT ${MAX_SYNC_LOGS}
      )
  `);
}

// ── ID mapping helpers ────────────────────────────────

export async function getMapping(
  tenantId: string,
  resourceType: (typeof wooCommerceIdMappings.$inferInsert)["resourceType"],
  localId: string,
) {
  return db.query.wooCommerceIdMappings.findFirst({
    where: and(
      eq(wooCommerceIdMappings.tenantId, tenantId),
      eq(wooCommerceIdMappings.resourceType, resourceType),
      eq(wooCommerceIdMappings.localId, localId),
    ),
  });
}

export async function getMappingByRemoteId(
  tenantId: string,
  resourceType: (typeof wooCommerceIdMappings.$inferInsert)["resourceType"],
  remoteId: number,
) {
  return db.query.wooCommerceIdMappings.findFirst({
    where: and(
      eq(wooCommerceIdMappings.tenantId, tenantId),
      eq(wooCommerceIdMappings.resourceType, resourceType),
      eq(wooCommerceIdMappings.remoteId, remoteId),
    ),
  });
}

export async function upsertMapping(
  tenantId: string,
  resourceType: (typeof wooCommerceIdMappings.$inferInsert)["resourceType"],
  localId: string,
  remoteId: number,
) {
  if (!remoteId || remoteId <= 0) {
    console.error(`[WC Mapping] Refusing to save invalid remoteId ${remoteId} for ${resourceType} ${localId}`);
    return;
  }
  await db
    .insert(wooCommerceIdMappings)
    .values({
      tenantId,
      resourceType,
      localId,
      remoteId,
      lastPushedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        wooCommerceIdMappings.tenantId,
        wooCommerceIdMappings.resourceType,
        wooCommerceIdMappings.localId,
      ],
      set: {
        remoteId,
        lastPushedAt: new Date(),
      },
    });
}

export async function deleteMapping(
  tenantId: string,
  resourceType: (typeof wooCommerceIdMappings.$inferInsert)["resourceType"],
  localId: string,
) {
  await db
    .delete(wooCommerceIdMappings)
    .where(
      and(
        eq(wooCommerceIdMappings.tenantId, tenantId),
        eq(wooCommerceIdMappings.resourceType, resourceType),
        eq(wooCommerceIdMappings.localId, localId),
      ),
    );
}

// ── Internal utilities ────────────────────────────────

async function updateLastSyncAt(tenantId: string) {
  await db
    .update(wooCommerceConnections)
    .set({ lastSyncAt: new Date(), updatedAt: new Date() })
    .where(eq(wooCommerceConnections.tenantId, tenantId));
}
