# WooCommerce Integration Design

**Date**: 2026-03-30
**Status**: Draft

## Overview

Enable PrepareOS tenants to sync their product catalog with a WooCommerce store and receive orders placed on the WordPress storefront. PrepareOS is the **master** for products, categories, and stock. WooCommerce is a display/sales channel that sends orders back.

### Goals

- Tenants manage products & categories in PrepareOS; changes push to WooCommerce automatically
- Orders placed on WooCommerce appear in PrepareOS with `source: "site_web"`, entering the normal kitchen workflow
- Stock is managed by PrepareOS; WooCommerce mirrors it (with local stock guard to prevent overselling)
- Platform admins manage WooCommerce connections per tenant from the admin dashboard
- No WordPress plugin required — uses WooCommerce REST API v3 + webhooks

### Non-Goals

- Bidirectional catalog sync (WooCommerce edits don't flow back to PrepareOS)
- Order backfill (only product & category backfill)
- Tenant self-service (admin-only for now)
- Encrypted credential storage (plain for now, noted for future)

---

## Data Model

### `wooCommerceConnections` table

One per tenant. Stores credentials and connection state.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, default random |
| `tenantId` | uuid | FK tenants, unique (one connection per tenant), cascade delete |
| `storeUrl` | varchar(500) | e.g. `https://shop.example.com` |
| `consumerKey` | varchar(500) | WooCommerce REST API consumer key |
| `consumerSecret` | varchar(500) | WooCommerce REST API consumer secret |
| `webhookSecret` | varchar(255) | Generated on connection setup, used to verify incoming webhook signatures (HMAC-SHA256) |
| `isEnabled` | boolean | Default true. Admin can disable sync without deleting credentials |
| `lastSyncAt` | timestamp | Last successful push to WooCommerce |
| `lastHealthCheckAt` | timestamp | Last successful `/system_status` call |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `wooCommerceIdMappings` table

Maps PrepareOS entity UUIDs to WooCommerce integer IDs. Required to know which WC entity to update/delete, and to resolve WC product IDs in incoming order webhooks back to PrepareOS UUIDs.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `tenantId` | uuid | FK tenants, cascade delete |
| `resourceType` | enum: `product`, `category`, `product_variant` | Entity type |
| `localId` | uuid | PrepareOS entity ID |
| `remoteId` | integer | WooCommerce entity ID |
| `lastPushedAt` | timestamp | Last time this mapping was synced |

Unique constraint: `(tenantId, resourceType, localId)`.

### `wooCommerceSyncLogs` table

Capped recent activity log. Pruned to most recent 20 entries per tenant on each insert.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `tenantId` | uuid | FK tenants, cascade delete |
| `action` | enum: `product_push`, `category_push`, `variant_push`, `stock_push`, `order_received`, `backfill`, `webhook_registered`, `connection_test`, `error` | |
| `status` | enum: `success`, `failure` | |
| `summary` | varchar(500) | Human-readable, e.g. "Pushed product 'Croissant' (WC #42)" |
| `details` | text | Optional error message or extra context |
| `createdAt` | timestamp | |

---

## Sync Architecture

### Approach: Inline sync (fire-and-log)

Sync happens synchronously after DB transactions commit. If WooCommerce is unreachable, the PrepareOS operation succeeds and the failure is logged. Matches existing SMS/email fire-and-log pattern.

### Flow: PrepareOS → WooCommerce (catalog push)

```
Product/Category/Variant create/update/delete in PrepareOS
  → DB transaction commits successfully
  → Check: does this tenant have an enabled WC connection?
    → No: done
    → Yes: call woocommerce.service push method
      → Look up ID mapping:
        - Mapping exists → PUT /wp-json/wc/v3/products/{remoteId} (update)
        - No mapping → POST /wp-json/wc/v3/products (create)
      → On success: upsert ID mapping, update lastSyncAt, log success
      → On failure: log failure with error details, continue
```

### Flow: Stock sync

PrepareOS is the **source of truth** for stock. WooCommerce also has `manage_stock: true` as a local guard to prevent overselling at checkout.

```
Stock changes in PrepareOS (order created/deleted, manual edit)
  → Push updated stock_quantity to WooCommerce for affected products/variants
  → WooCommerce uses its local stock to guard checkout

WooCommerce order placed:
  → WC deducts its own stock locally (prevents overselling)
  → Webhook fires → PrepareOS creates order, deducts its stock
  → PrepareOS pushes corrected stock back to WC (reconcile drift)
```

### Flow: WooCommerce → PrepareOS (order receive)

```
WooCommerce webhook POST /api/woocommerce/webhooks/:tenantId/orders
  → Verify HMAC-SHA256 signature (X-WC-Webhook-Signature header vs webhookSecret)
  → Reject if invalid signature (401)
  → Parse order payload
  → Map WC order status → PrepareOS statuses (hardcoded, see mapping below)
  → Map WC line_items product IDs → PrepareOS UUIDs via wooCommerceIdMappings
  → Resolve or create client from WC billing info (match by phone or email)
  → Create or update PrepareOS order:
    - source: "site_web"
    - Deduct stock (standard order creation flow)
  → Push corrected stock back to WooCommerce
  → Log sync event
```

### Order status mapping

Hardcoded defaults. Could make configurable later.

| WooCommerce status | PrepareOS `paymentStatus` | PrepareOS `preparationStatus` |
|---|---|---|
| `pending` | `pending` | `pending` |
| `on-hold` | `pending` | `pending` |
| `processing` | `paid` | `pending` |
| `completed` | `paid` | `picked_up` |
| `refunded` | `refunded` | keep current |
| `failed` | skip — don't create order | |
| `cancelled` | skip — don't create order | |
| Any custom status | `pending` | `pending` (fallback) |

### Flow: Connection setup

```
Admin submits form (storeUrl, consumerKey, consumerSecret)
  → GET /wp-json/wc/v3/system_status — test credentials
  → On failure: return error, don't save
  → On success:
    → Generate webhookSecret (crypto.randomUUID())
    → Save wooCommerceConnection to DB
    → Register webhooks on WooCommerce:
      - POST /wp-json/wc/v3/webhooks — topic: "order.created"
        delivery_url: https://{apiHost}/api/woocommerce/webhooks/{tenantId}/orders
        secret: webhookSecret
      - POST /wp-json/wc/v3/webhooks — topic: "order.updated"
        delivery_url: same
    → Log "connection_test" + "webhook_registered" events
```

### Flow: Disconnect

```
Admin clicks disconnect (with confirmation)
  → Fetch registered webhook IDs from WooCommerce (GET /wp-json/wc/v3/webhooks)
  → Delete each webhook matching our delivery_url (DELETE /wp-json/wc/v3/webhooks/{id})
  → Delete wooCommerceConnection from DB (cascades to ID mappings and logs)
```

### Flow: Backfill

Uses WooCommerce batch endpoints (`POST /wp-json/wc/v3/products/batch`, `/products/categories/batch`) for efficiency. Batch endpoints accept up to 100 items per call with `create` and `update` arrays. Most bakery catalogs fit in 1-2 API calls.

```
Admin clicks "Backfill to WooCommerce" (with confirmation)
  → Fetch all active categories for tenant
    → Split into create vs update (based on existing ID mappings)
    → POST /wp-json/wc/v3/products/categories/batch { create: [...], update: [...] }
    → Upsert ID mappings from response
  → Fetch all active products for tenant
    → Resolve category IDs via mappings
    → Split into create vs update
    → POST /wp-json/wc/v3/products/batch { create: [...], update: [...] }
    → Upsert ID mappings from response
  → Fetch all active variants (grouped by parent product)
    → POST /wp-json/wc/v3/products/{productId}/variations/batch per parent
    → Upsert ID mappings
  → Log backfill summary ("Backfill completed: 12 categories, 45 products, 8 variants")
```

Categories are batched first since products reference them. If catalog exceeds 100 items, chunk into multiple batch calls.

### Flow: Manual re-sync

Same as backfill. The "Sync" button and "Backfill" button do the same thing — push current state. Backfill is labeled for first-time use, sync for ongoing corrections.

### Flow: Liveness check

```
Admin loads tenant page or clicks refresh
  → GET /wp-json/wc/v3/system_status with stored credentials
  → On success: update lastHealthCheckAt, return store name + WC version
  → On failure: return error status
  → UI shows green/red dot + metadata
```

---

## Field Mapping

### Product: PrepareOS → WooCommerce

| PrepareOS field | WooCommerce field | Notes |
|---|---|---|
| `name` | `name` | Direct |
| `shortDescription` | `short_description` | Direct |
| `description` | `description` | Direct |
| `price` | `regular_price` | String in WC |
| `imageUrl` | `images[0].src` | Primary image |
| `galleryUrls` | `images[1..n].src` | Additional images |
| `stock` | `stock_quantity` | Null in PrepareOS → `manage_stock: false` in WC |
| `isActive` | `status` | `true` → `"publish"`, `false` → `"draft"` |
| `categoryId` | `categories[0].id` | Resolved via ID mapping |
| `unitType` | `meta_data` | Stored as custom meta `_prepareos_unit_type` |
| `hasVariants` | `type` | `true` → `"variable"`, `false` → `"simple"` |

### Category: PrepareOS → WooCommerce

| PrepareOS field | WooCommerce field | Notes |
|---|---|---|
| `name` | `name` | Direct |
| `description` | `description` | Direct |
| `parentId` | `parent` | Resolved via ID mapping (0 if root) |
| `imageUrl` | `image.src` | Single image |

### Variant: PrepareOS → WooCommerce

| PrepareOS field | WooCommerce field | Notes |
|---|---|---|
| `name` | `attributes[0].option` | WC variations use attribute values |
| `price` | `regular_price` | String in WC |
| `stock` | `stock_quantity` | |
| `isActive` | `status` | `true` → `"publish"`, `false` → `"private"` |

### Order: WooCommerce → PrepareOS

| WooCommerce field | PrepareOS field | Notes |
|---|---|---|
| `id` | — | Stored in a sync reference, not in orders table |
| `status` | `paymentStatus` + `preparationStatus` | See status mapping table |
| `billing.first_name + last_name` | Client `name` | Resolve or create client |
| `billing.phone` | Client `phone` | Used for client matching |
| `billing.email` | Client `email` | Used for client matching |
| `customer_note` | `clientNote` | |
| `line_items[].product_id` | `orderItems[].productId` | Resolved via ID mapping |
| `line_items[].variation_id` | `orderItems[].variantId` | Resolved via ID mapping |
| `line_items[].name` | `orderItems[].productName` | Denormalized |
| `line_items[].quantity` | `orderItems[].quantity` | |
| `line_items[].price` | `orderItems[].unitPrice` | |
| `line_items[].total` | `orderItems[].totalPrice` | |
| `total` | `total` | |
| — | `source` | Always `"site_web"` |
| — | `ticketNumber` | Auto-generated |

---

## API Routes

### Webhook routes (public, HMAC-verified)

```
POST /api/woocommerce/webhooks/:tenantId/orders
  — No auth middleware (public endpoint)
  — Verified via HMAC-SHA256 signature in X-WC-Webhook-Signature header
  — Handles order.created and order.updated topics (distinguished by X-WC-Webhook-Topic header)
```

### Admin routes (platform admin only)

```
GET    /api/admin/tenants/:tenantId/woocommerce          — Connection status + config (secrets masked)
POST   /api/admin/tenants/:tenantId/woocommerce/connect   — Create connection, test, register webhooks
POST   /api/admin/tenants/:tenantId/woocommerce/disconnect — Remove webhooks, delete connection
PATCH  /api/admin/tenants/:tenantId/woocommerce/toggle     — Enable/disable without deleting
POST   /api/admin/tenants/:tenantId/woocommerce/sync       — Manual re-sync all products & categories
POST   /api/admin/tenants/:tenantId/woocommerce/backfill   — First-time push of existing catalog
GET    /api/admin/tenants/:tenantId/woocommerce/health     — Live check against WC system_status
GET    /api/admin/tenants/:tenantId/woocommerce/logs       — Recent 20 sync log entries
```

---

## Service Layer

### `woocommerce.client.ts` — HTTP wrapper

Thin wrapper around WooCommerce REST API v3. Handles authentication (Basic auth with consumer key/secret), response parsing, and error extraction.

Methods:
- `getSystemStatus()` — `GET /wp-json/wc/v3/system_status`
- `createProduct(data)` — `POST /wp-json/wc/v3/products`
- `updateProduct(id, data)` — `PUT /wp-json/wc/v3/products/{id}`
- `deleteProduct(id)` — `DELETE /wp-json/wc/v3/products/{id}`
- `createCategory(data)` — `POST /wp-json/wc/v3/products/categories`
- `updateCategory(id, data)` — `PUT /wp-json/wc/v3/products/categories/{id}`
- `deleteCategory(id)` — `DELETE /wp-json/wc/v3/products/categories/{id}`
- `createVariation(productId, data)` — `POST /wp-json/wc/v3/products/{productId}/variations`
- `updateVariation(productId, id, data)` — `PUT /wp-json/wc/v3/products/{productId}/variations/{id}`
- `deleteVariation(productId, id)` — `DELETE /wp-json/wc/v3/products/{productId}/variations/{id}`
- `batchProducts(create[], update[])` — `POST /wp-json/wc/v3/products/batch`
- `batchCategories(create[], update[])` — `POST /wp-json/wc/v3/products/categories/batch`
- `batchVariations(productId, create[], update[])` — `POST /wp-json/wc/v3/products/{productId}/variations/batch`
- `updateStock(productId, stockQty)` — `PATCH /wp-json/wc/v3/products/{productId}` with `stock_quantity`
- `createWebhook(topic, deliveryUrl, secret)` — `POST /wp-json/wc/v3/webhooks`
- `listWebhooks()` — `GET /wp-json/wc/v3/webhooks`
- `deleteWebhook(id)` — `DELETE /wp-json/wc/v3/webhooks/{id}`

### `woocommerce.service.ts` — sync logic

Core service handling all sync operations.

- `testConnection(storeUrl, consumerKey, consumerSecret)` — call system_status, return store info
- `connect(tenantId, config)` — save connection + register webhooks on WC
- `disconnect(tenantId)` — remove webhooks from WC + delete connection from DB
- `toggleConnection(tenantId, isEnabled)` — enable/disable
- `pushProduct(tenantId, productId)` — map fields, create or update in WC, upsert ID mapping
- `pushCategory(tenantId, categoryId)` — same for categories
- `pushVariant(tenantId, variantId)` — same for variants (under parent product in WC)
- `pushStock(tenantId, productId)` — update stock_quantity in WC
- `deleteRemoteProduct(tenantId, productId)` — delete from WC + remove ID mapping
- `deleteRemoteCategory(tenantId, categoryId)` — same
- `backfill(tenantId)` — push all categories → products → variants
- `getConnection(tenantId)` — fetch connection with masked secrets
- `getHealth(tenantId)` — call system_status, update lastHealthCheckAt
- `getLogs(tenantId)` — fetch recent 20 log entries
- `logSyncEvent(tenantId, action, status, summary, details?)` — insert log + prune entries beyond 20

### `woocommerce-orders.service.ts` — inbound orders

- `handleOrderWebhook(tenantId, payload, signature)` — verify HMAC, dispatch to create or update
- `verifySignature(payload, signature, secret)` — HMAC-SHA256 verification
- `mapWcOrderToLocal(tenantId, wcOrder)` — transform WC order to PrepareOS CreateOrder shape
- `resolveOrCreateClient(tenantId, billing)` — find client by phone/email or create
- `mapOrderStatus(wcStatus)` — WC status string → { paymentStatus, preparationStatus }

### Integration in existing services

In `product.service.ts`, `category.service.ts`, `variant.service.ts` — after create/update/delete:

```typescript
// After successful DB operation
try {
  await woocommerceService.pushProduct(tenantId, product.id);
} catch (e) {
  // Logged inside pushProduct, don't fail the main operation
}
```

For stock changes (in `order.service.ts`):

```typescript
// After stock deduction/restoration
try {
  for (const productId of affectedProductIds) {
    await woocommerceService.pushStock(tenantId, productId);
  }
} catch (e) {
  // Logged inside pushStock
}
```

---

## Admin UI

Located in `/app/(admin)/(authenticated)/tenants/[tenantId]` — new section on the tenant detail page.

### Components

**WooCommerceConnectionCard** — main container:
- No connection: renders `WooCommerceConnectForm`
- Connected: renders `WooCommerceStatusCard` + `WooCommerceActions` + `WooCommerceSyncLog`

**WooCommerceConnectForm**:
- Fields: Store URL, Consumer Key, Consumer Secret
- "Test & Connect" button
- Shows validation errors and API test errors inline

**WooCommerceStatusCard** (when connected):
- Store URL, connected since date
- Green/red liveness dot (from `/health` endpoint, called on mount)
- WooCommerce version + store name (from system_status)
- Last sync timestamp
- Registered webhooks list with status (active/paused/disabled)
- Enable/disable toggle switch
- Disconnect button with confirmation dialog

**WooCommerceActions** (button row):
- "Sync Products & Categories" — triggers `/sync`, shows loading + result toast
- "Backfill to WooCommerce" — triggers `/backfill`, confirmation dialog first, shows loading + result toast

**WooCommerceSyncLog**:
- Simple table: timestamp | action | status badge (success/failure) | summary
- Last 20 entries, no pagination
- Fetched from `/logs` endpoint

### Data fetching (TanStack Query)

- `useWooCommerceConnection(tenantId)` — `GET /api/admin/tenants/:tenantId/woocommerce`
- `useWooCommerceHealth(tenantId)` — `GET .../health` (enabled only when connected)
- `useWooCommerceLogs(tenantId)` — `GET .../logs`
- `useConnectWooCommerce()` — mutation for `POST .../connect`
- `useDisconnectWooCommerce()` — mutation for `POST .../disconnect`
- `useToggleWooCommerce()` — mutation for `PATCH .../toggle`
- `useSyncWooCommerce()` — mutation for `POST .../sync`
- `useBackfillWooCommerce()` — mutation for `POST .../backfill`

---

## Common Pitfalls & Mitigations

| Pitfall | Mitigation |
|---|---|
| Race condition: two WC orders deplete same stock | WC has `manage_stock: true` as local guard; PrepareOS reconciles after each order |
| Webhook delivery failure (WC auto-disables after 5 failures) | Health check surfaces webhook status; admin can re-register via disconnect + reconnect |
| ID mapping drift (product deleted in WC manually) | Push operations handle 404 from WC by creating a new entity and updating the mapping |
| Backfill timeout for large catalogs | Batch endpoints handle up to 100 items per call; most catalogs fit in 1-2 calls |
| WC API rate limits (25 req/10s if enabled) | Backfill uses batch endpoints (few calls total); individual pushes are infrequent |
| Stale stock after PrepareOS order without WC sync failing | Manual re-sync button covers recovery; sync log shows the failure |
| Duplicate orders from webhook retry | Check if order with same WC order ID already exists in ID mappings before creating |
| WC order references unknown product (not synced) | Log warning, create order item with product name from WC payload but null productId |

---

## Future Considerations

- Configurable order status mapping per tenant (currently hardcoded)
- Encrypted credential storage for consumerKey/consumerSecret
- Tenant self-service connection management
- Bidirectional product sync
- Batch API calls for individual sync operations (currently only used for backfill)
- Webhook status monitoring with automatic re-registration
