# Points of Sale (Points de vente) — Design

**Date:** 2026-03-10
**Status:** Approved

## Summary

Add a Point of Sale (POS) entity so tenants can define pickup locations and permanent counters, then assign orders to a specific POS.

## Schema

### New table: `points_of_sale`

| Field | Type | Constraints |
|---|---|---|
| id | uuid | PK, default `gen_random_uuid()` |
| tenant_id | uuid | FK → tenants, NOT NULL, cascade delete |
| name | varchar(200) | NOT NULL |
| description | text | nullable |
| address | text | nullable |
| phone | varchar(20) | nullable |
| type | enum(`pickup_location`, `permanent_pos`) | NOT NULL |
| is_active | boolean | NOT NULL, default `true` |
| sort_order | integer | NOT NULL, default `0` |
| created_at | timestamptz | NOT NULL, default `now()` |
| updated_at | timestamptz | NOT NULL, default `now()` |

**Indexes:** `(tenant_id)`, unique `(tenant_id, name)`

### Orders table change

Add nullable column `pos_id` (uuid, FK → `points_of_sale`, set null on delete) to the `orders` table. One POS per order.

### Relations

- `points_of_sale` → many `orders`
- `orders` → one `point_of_sale` (optional)

## POS Types

- **`pickup_location`** — Collection point for pre-orders (e.g. "Retrait Drive", "Marche du samedi")
- **`permanent_pos`** — Fixed counter/station (e.g. "Comptoir principal", "Caisse 1")

Both types can receive orders. The distinction is informational for now; richer POS-specific features (assigned staff, cash register, reporting) can build on this later.

## Backend

### Routes (`/api/points-of-sale`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | any authenticated | List (paginated, filter by `type`, `isActive`) |
| GET | `/:id` | any authenticated | Get by ID |
| POST | `/` | admin/owner | Create |
| PATCH | `/:id` | admin/owner | Update |
| DELETE | `/:id` | admin/owner | Delete (fail if orders reference it) |

### Service

Standard CRUD scoped by `tenantId`. Follows existing patterns in `category.service.ts`.

### Order integration

- Add `posId` to order create/update Zod schemas (optional)
- Include `pointOfSale` relation when fetching orders (`with: { pointOfSale: true }`)

## Frontend

### CRUD pages (`/points-of-sale`)

- **List** — Table with columns: name, type badge, address, active status. Refresh + create buttons in header. Follows categories page pattern.
- **Create** (`/points-of-sale/create`) — Form: name, type select, description, address, phone, isActive, sortOrder.
- **Edit** (`/points-of-sale/[id]`) — Same form pre-filled + delete button with confirmation dialog.

### Form component

`components/forms/point-of-sale-form.tsx` — shared between create and edit pages. Uses react-hook-form + Zod resolver. Follows `category-form.tsx` pattern.

### Sidebar

Add "Points de vente" to the management navigation section (admin/owner only) with `Store` icon from lucide. URL: `/points-of-sale`.

### Order forms

Add optional POS select dropdown wherever orders are created/edited. Shows active POS grouped by type.

### Preparation page

Show POS name as a small badge on `OrderRow` when assigned.

## UI Labels (French)

- Page title: "Points de vente"
- Page description: "Gerez vos points de vente et de retrait"
- Type labels: "Point de retrait" / "Point de vente permanent"
- Sidebar: "Points de vente"

## API client functions

Added to `apps/client/lib/api.ts`:
- `fetchPointsOfSale(params?)` → paginated list
- `fetchPointOfSale(id)` → single
- `createPointOfSale(data)` → create
- `updatePointOfSale(id, data)` → update
- `deletePointOfSale(id)` → delete

## Shared data package

- New file: `packages/data/src/schema/points-of-sale.ts`
- Exports: table, relations, Zod schemas (create, update, filters), TypeScript types
- Re-export from `packages/data/src/schema/index.ts`
