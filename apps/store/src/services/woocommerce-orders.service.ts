import { clients, products, productVariants, type CreateOrderItem } from "@prepareos/data";
import { and, eq, ilike, or } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "../db/index.js";
import { createOrder } from "./order.service.js";
import {
  getMappingByRemoteId,
  getRawConnection,
  logSyncEvent,
  pushStock,
} from "./woocommerce.service.js";

// ── WooCommerce status → PrepareOS status mapping ────────
// Could make configurable later via a tenant setting
const STATUS_MAP: Record<
  string,
  {
    paymentStatus: "pending" | "paid" | "refunded";
    preparationStatus: "pending" | "picked_up" | "__keep__";
  }
> = {
  pending: { paymentStatus: "pending", preparationStatus: "pending" },
  "on-hold": { paymentStatus: "pending", preparationStatus: "pending" },
  processing: { paymentStatus: "paid", preparationStatus: "pending" },
  completed: { paymentStatus: "paid", preparationStatus: "picked_up" },
  refunded: { paymentStatus: "refunded", preparationStatus: "__keep__" },
};

const SKIP_STATUSES = new Set(["failed", "cancelled"]);

// ── WooCommerce payload types (subset) ───────────────────

interface WcBilling {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface WcLineItem {
  product_id: number;
  variation_id: number;
  name: string;
  quantity: number;
  price: string;
}

interface WcOrderPayload {
  id?: number;
  status: string;
  billing: WcBilling;
  line_items: WcLineItem[];
  customer_note?: string;
}

// ── Signature verification ───────────────────────────────

export function verifySignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody);
  const expected = hmac.digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "base64"),
      Buffer.from(expected, "base64"),
    );
  } catch {
    // Length mismatch → invalid
    return false;
  }
}

// ── Main webhook handler ─────────────────────────────────

export async function handleOrderWebhook(
  tenantId: string,
  rawBody: string | Buffer,
  signature: string,
  topic: string,
): Promise<{ status: "ok" | "skipped" | "error"; message: string }> {
  // 1. Get connection and check enabled
  const conn = await getRawConnection(tenantId);
  if (!conn || !conn.isEnabled) {
    return { status: "skipped", message: "Connection not found or disabled" };
  }

  // 2. Verify HMAC signature
  if (!verifySignature(rawBody, signature, conn.webhookSecret)) {
    await logSyncEvent(
      tenantId,
      "order_received",
      "failure",
      "Invalid webhook signature",
    );
    return { status: "error", message: "Invalid signature" };
  }

  // 3. Parse payload
  let payload: WcOrderPayload;
  try {
    payload = JSON.parse(
      typeof rawBody === "string" ? rawBody : rawBody.toString("utf-8"),
    );
  } catch {
    return { status: "error", message: "Invalid JSON payload" };
  }

  // 4. Handle ping (WC sends a payload without `id` on webhook creation)
  if (!payload.id) {
    return { status: "ok", message: "Ping acknowledged" };
  }

  // 5. Map WC status
  const wcStatus = payload.status;
  if (SKIP_STATUSES.has(wcStatus)) {
    return {
      status: "skipped",
      message: `Skipped order with status "${wcStatus}"`,
    };
  }

  const statusConfig = STATUS_MAP[wcStatus] ?? {
    paymentStatus: "pending" as const,
    preparationStatus: "pending" as const,
  };

  // 6. Dispatch based on topic
  try {
    if (topic === "order.created") {
      await createOrderFromWc(tenantId, payload, statusConfig);
      return { status: "ok", message: `Order #${payload.id} created` };
    }
    if (topic === "order.updated") {
      await updateOrderFromWc(tenantId, payload, statusConfig);
      return { status: "ok", message: `Order #${payload.id} update logged` };
    }
    return { status: "skipped", message: `Unhandled topic "${topic}"` };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await logSyncEvent(
      tenantId,
      "order_received",
      "failure",
      `Failed to process WC order #${payload.id}`,
      errMsg,
    );
    return { status: "error", message: errMsg };
  }
}

// ── Create order from WooCommerce ────────────────────────

async function createOrderFromWc(
  tenantId: string,
  payload: WcOrderPayload,
  statusConfig: { paymentStatus: string; preparationStatus: string },
) {
  // 1. Resolve or create client from billing info
  const clientId = await resolveOrCreateClient(tenantId, payload.billing);

  // 2. Map line_items to PrepareOS order items
  const mappedItems: CreateOrderItem[] = [];
  const affectedProductIds: string[] = [];

  for (const lineItem of payload.line_items) {
    // Resolve WC product_id → PrepareOS UUID
    const productMapping = await getMappingByRemoteId(
      tenantId,
      "product",
      lineItem.product_id,
    );
    if (!productMapping) continue;

    const productId = productMapping.localId;

    // Fetch product name and price from local DB
    const product = await db.query.products.findFirst({
      where: and(eq(products.id, productId), eq(products.tenantId, tenantId)),
    });
    if (!product) continue;

    // Resolve variation_id if present
    let variantId: string | undefined;
    let variantName: string | undefined;
    let unitPrice = lineItem.price;

    if (lineItem.variation_id && lineItem.variation_id !== 0) {
      const variantMapping = await getMappingByRemoteId(
        tenantId,
        "product_variant",
        lineItem.variation_id,
      );
      if (variantMapping) {
        variantId = variantMapping.localId;
        const variant = await db.query.productVariants.findFirst({
          where: and(
            eq(productVariants.id, variantId),
            eq(productVariants.tenantId, tenantId),
          ),
        });
        if (variant) {
          variantName = variant.name;
          unitPrice = variant.price;
        }
      }
    }

    mappedItems.push({
      productId,
      productName: product.name,
      variantId,
      variantName,
      quantity: lineItem.quantity,
      unitPrice,
      unit: product.unitType,
    });

    if (!affectedProductIds.includes(productId)) {
      affectedProductIds.push(productId);
    }
  }

  // 3. Filter to items with valid productId (already done above via continue)
  if (mappedItems.length === 0) {
    await logSyncEvent(
      tenantId,
      "order_received",
      "failure",
      `WC order #${payload.id}: no mappable items found`,
    );
    return;
  }

  // 4. Create order with source "site_web"
  await createOrder(tenantId, {
    clientId: clientId ?? undefined,
    pickupDate: new Date(), // default to now, can be adjusted later
    source: "site_web",
    paymentStatus: statusConfig.paymentStatus as "pending" | "paid" | "refunded",
    clientNote: payload.customer_note ?? undefined,
    items: mappedItems,
  });

  // 5. Push corrected stock back to WC for affected products
  for (const pid of affectedProductIds) {
    await pushStock(tenantId, pid);
  }

  // 6. Log sync event
  await logSyncEvent(
    tenantId,
    "order_received",
    "success",
    `Created order from WC #${payload.id} (${mappedItems.length} items)`,
  );
}

// ── Update order from WooCommerce ────────────────────────

async function updateOrderFromWc(
  tenantId: string,
  payload: WcOrderPayload,
  statusConfig: { paymentStatus: string; preparationStatus: string },
) {
  // For now, just log the status update — we don't modify existing orders
  // from WC updates yet
  await logSyncEvent(
    tenantId,
    "order_received",
    "success",
    `WC order #${payload.id} updated to "${payload.status}" — logged only (payment: ${statusConfig.paymentStatus}, preparation: ${statusConfig.preparationStatus})`,
  );
}

// ── Resolve or create client from WC billing ─────────────

async function resolveOrCreateClient(
  tenantId: string,
  billing: WcBilling,
): Promise<string | null> {
  const phone = billing.phone?.trim() || null;
  const email = billing.email?.trim() || null;

  if (!phone && !email) return null;

  // 1. Try to find existing client by phone or email
  const conditions = [];
  if (phone) conditions.push(ilike(clients.phone, phone));
  if (email) conditions.push(ilike(clients.email, email));

  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.tenantId, tenantId), or(...conditions)),
  });

  if (existing) return existing.id;

  // 2. Create new client
  const name = [billing.first_name, billing.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!name) return null;

  const [created] = await db
    .insert(clients)
    .values({
      name,
      phone,
      email,
      tenantId,
    })
    .returning();

  return created.id;
}
