# Points of Sale Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Point of Sale entity (pickup locations + permanent counters) with full CRUD, then link orders to a POS.

**Architecture:** New `points_of_sale` table in the shared data package, standard Hono CRUD routes + service in the store API, Next.js CRUD pages on the client. Orders get a nullable `posId` FK. Follows all existing patterns (categories as reference).

**Tech Stack:** Drizzle ORM, Zod, Hono, React Hook Form, TanStack Query, shadcn/ui

---

### Task 1: Schema — `points_of_sale` table + enum

**Files:**
- Create: `packages/data/src/schema/points-of-sale.ts`
- Modify: `packages/data/src/schema/index.ts`

**Step 1: Create the schema file**

Create `packages/data/src/schema/points-of-sale.ts`:

```typescript
import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { tenants } from "./tenants.js";

export const posTypeEnum = pgEnum("pos_type", [
  "pickup_location",
  "permanent_pos",
]);

export const pointsOfSale = pgTable(
  "points_of_sale",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    address: text("address"),
    phone: varchar("phone", { length: 20 }),
    type: posTypeEnum("type").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("points_of_sale_tenant_id_idx").on(table.tenantId),
    unique("points_of_sale_tenant_name_unique").on(table.tenantId, table.name),
  ],
);

export const pointsOfSaleRelations = relations(pointsOfSale, ({ one }) => ({
  tenant: one(tenants, {
    fields: [pointsOfSale.tenantId],
    references: [tenants.id],
  }),
}));

// Drizzle types
export type PointOfSale = typeof pointsOfSale.$inferSelect;
export type NewPointOfSale = typeof pointsOfSale.$inferInsert;

// Zod schemas from drizzle-zod
export const insertPointOfSaleSchema = createInsertSchema(pointsOfSale);
export const selectPointOfSaleSchema = createSelectSchema(pointsOfSale);

// POS type schema
export const posTypeSchema = z.enum(["pickup_location", "permanent_pos"]);

// Custom schemas for API
export const createPointOfSaleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(20).optional(),
  type: posTypeSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const updatePointOfSaleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  type: posTypeSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const pointOfSaleFiltersSchema = z.object({
  type: posTypeSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Types
export type CreatePointOfSale = z.infer<typeof createPointOfSaleSchema>;
export type UpdatePointOfSale = z.infer<typeof updatePointOfSaleSchema>;
export type PointOfSaleFilters = z.infer<typeof pointOfSaleFiltersSchema>;
export type PosType = z.infer<typeof posTypeSchema>;
```

**Step 2: Export from schema index**

In `packages/data/src/schema/index.ts`, add at the end:

```typescript
export * from "./points-of-sale.js";
```

**Step 3: Verify build**

Run: `cd packages/data && pnpm build`
Expected: SUCCESS, no type errors

**Step 4: Commit**

```bash
git add packages/data/src/schema/points-of-sale.ts packages/data/src/schema/index.ts
git commit -m "feat: add points_of_sale schema and Zod validators"
```

---

### Task 2: Schema — Add `posId` to orders table + update relations

**Files:**
- Modify: `packages/data/src/schema/orders.ts` (add posId field, update relations, update Zod schemas)
- Modify: `packages/data/src/schema/points-of-sale.ts` (add orders relation)

**Step 1: Add posId field to orders table**

In `packages/data/src/schema/orders.ts`:

1. Add import at top (after the existing imports):
```typescript
import { pointsOfSale } from "./points-of-sale.js";
```

2. Add `posId` field to the orders table, after `assignedToId` (line ~61):
```typescript
    posId: uuid("pos_id").references(() => pointsOfSale.id, { onDelete: "set null" }),
```

3. Add `pointOfSale` to `ordersRelations` (after the `assignedTo` relation, around line 145):
```typescript
  pointOfSale: one(pointsOfSale, {
    fields: [orders.posId],
    references: [pointsOfSale.id],
  }),
```

4. Add `posId` to `createOrderSchema` (optional):
```typescript
  posId: z.string().uuid().nullable().optional(),
```

5. Add `posId` to `updateOrderSchema` (optional, nullable):
```typescript
  posId: z.string().uuid().nullable().optional(),
```

6. Add `posId` to `orderFiltersSchema`:
```typescript
  posId: z.string().uuid().optional(),
```

7. Update `OrderWithItems` type to include POS:
```typescript
export type PointOfSaleRef = Pick<PointOfSale, "id" | "name" | "type">;

export type OrderWithItems = Order & {
  items: OrderItemWithMenuItems[];
  client?: ClientRef | null;
  createdBy?: UserRef;
  assignedTo?: UserRef;
  pointOfSale?: PointOfSaleRef | null;
};
```

Add import for PointOfSale type:
```typescript
import { pointsOfSale, type PointOfSale } from "./points-of-sale.js";
```

**Step 2: Add orders relation to points-of-sale schema**

In `packages/data/src/schema/points-of-sale.ts`, update the relations to include orders. You'll need to import orders:

```typescript
import { orders } from "./orders.js";
```

Update the relations (change `one` to include `many`):
```typescript
export const pointsOfSaleRelations = relations(pointsOfSale, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pointsOfSale.tenantId],
    references: [tenants.id],
  }),
  orders: many(orders),
}));
```

**Note:** This creates a circular import between orders.ts and points-of-sale.ts. Drizzle handles this via lazy references. If there's a build issue, use `(): any => pointsOfSale.id` pattern in orders.ts for the FK reference, similar to how categories.ts handles self-references.

**Step 3: Verify build**

Run: `cd packages/data && pnpm build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add packages/data/src/schema/orders.ts packages/data/src/schema/points-of-sale.ts
git commit -m "feat: add posId to orders table and bidirectional relations"
```

---

### Task 3: Database migration

**Step 1: Generate the migration**

Run: `cd apps/store && pnpm drizzle-kit generate`

This should generate a migration file in the drizzle output directory that:
- Creates the `pos_type` enum
- Creates the `points_of_sale` table with all columns and indices
- Adds `pos_id` column to `orders` table with FK constraint

**Step 2: Review the generated SQL**

Read the generated migration file and verify it matches the design.

**Step 3: Run the migration**

Run: `cd apps/store && pnpm drizzle-kit migrate`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add apps/store/drizzle/
git commit -m "feat: database migration for points_of_sale table and orders.pos_id"
```

---

### Task 4: Backend — POS service

**Files:**
- Create: `apps/store/src/services/point-of-sale.service.ts`

**Step 1: Create the service file**

Create `apps/store/src/services/point-of-sale.service.ts`:

```typescript
import { eq, and, sql, asc } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  pointsOfSale,
  orders,
  type CreatePointOfSale,
  type UpdatePointOfSale,
  type PointOfSaleFilters,
} from "@prepareos/data";

export async function listPointsOfSale(tenantId: string, filters: PointOfSaleFilters) {
  const { type, isActive, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [eq(pointsOfSale.tenantId, tenantId)];

  if (type) {
    conditions.push(eq(pointsOfSale.type, type));
  }

  if (isActive !== undefined) {
    conditions.push(eq(pointsOfSale.isActive, isActive));
  }

  const whereClause = and(...conditions);

  const [data, countResult] = await Promise.all([
    db.query.pointsOfSale.findMany({
      where: whereClause,
      limit,
      offset,
      orderBy: [asc(pointsOfSale.sortOrder), asc(pointsOfSale.name)],
    }),
    db
      .select({ count: sql<number>`count(*)` })
      .from(pointsOfSale)
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

export async function getPointOfSaleById(tenantId: string, id: string) {
  return db.query.pointsOfSale.findFirst({
    where: and(eq(pointsOfSale.id, id), eq(pointsOfSale.tenantId, tenantId)),
  });
}

export async function createPointOfSale(tenantId: string, data: CreatePointOfSale) {
  const [pos] = await db
    .insert(pointsOfSale)
    .values({
      name: data.name,
      description: data.description ?? null,
      address: data.address ?? null,
      phone: data.phone ?? null,
      type: data.type,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      tenantId,
    })
    .returning();

  return pos;
}

export async function updatePointOfSale(tenantId: string, id: string, data: UpdatePointOfSale) {
  const updateData: Partial<typeof pointsOfSale.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  await db
    .update(pointsOfSale)
    .set(updateData)
    .where(and(eq(pointsOfSale.id, id), eq(pointsOfSale.tenantId, tenantId)));

  return getPointOfSaleById(tenantId, id);
}

export async function countOrdersByPointOfSale(tenantId: string, posId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.posId, posId), eq(orders.tenantId, tenantId)));

  return Number(result[0]?.count ?? 0);
}

export async function deletePointOfSale(tenantId: string, id: string) {
  const [deleted] = await db
    .delete(pointsOfSale)
    .where(and(eq(pointsOfSale.id, id), eq(pointsOfSale.tenantId, tenantId)))
    .returning({ id: pointsOfSale.id });

  return deleted;
}
```

**Step 2: Verify build**

Run: `cd apps/store && pnpm build`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add apps/store/src/services/point-of-sale.service.ts
git commit -m "feat: add point-of-sale service with CRUD operations"
```

---

### Task 5: Backend — POS routes

**Files:**
- Create: `apps/store/src/routes/points-of-sale.ts`
- Modify: `apps/store/src/index.ts` (register route)

**Step 1: Create the route file**

Create `apps/store/src/routes/points-of-sale.ts`:

```typescript
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createPointOfSaleSchema,
  updatePointOfSaleSchema,
  pointOfSaleFiltersSchema,
} from "@prepareos/data";
import * as posService from "../services/point-of-sale.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const pointsOfSale = new Hono<AppEnv>();

pointsOfSale.use("*", authMiddleware);

pointsOfSale.get("/", zValidator("query", pointOfSaleFiltersSchema), async (c) => {
  const tenantId = c.get("tenantId") as string;
  const filters = c.req.valid("query");
  const result = await posService.listPointsOfSale(tenantId, filters);
  return c.json(result);
});

pointsOfSale.get("/:id", async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");
  const pos = await posService.getPointOfSaleById(tenantId, id);

  if (!pos) {
    return c.json({ error: "Point of sale not found" }, 404);
  }

  return c.json(pos);
});

pointsOfSale.post(
  "/",
  ownerOrAdmin,
  zValidator("json", createPointOfSaleSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const data = c.req.valid("json");
    const pos = await posService.createPointOfSale(tenantId, data);
    return c.json(pos, 201);
  },
);

pointsOfSale.patch(
  "/:id",
  ownerOrAdmin,
  zValidator("json", updatePointOfSaleSchema),
  async (c) => {
    const tenantId = c.get("tenantId") as string;
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await posService.getPointOfSaleById(tenantId, id);
    if (!existing) {
      return c.json({ error: "Point of sale not found" }, 404);
    }

    const pos = await posService.updatePointOfSale(tenantId, id, data);
    return c.json(pos);
  },
);

pointsOfSale.delete("/:id", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;
  const id = c.req.param("id");

  const existing = await posService.getPointOfSaleById(tenantId, id);
  if (!existing) {
    return c.json({ error: "Point of sale not found" }, 404);
  }

  const orderCount = await posService.countOrdersByPointOfSale(tenantId, id);
  if (orderCount > 0) {
    return c.json(
      { error: `Cannot delete: ${orderCount} order(s) still reference this point of sale` },
      409,
    );
  }

  await posService.deletePointOfSale(tenantId, id);
  return c.json({ success: true });
});

export default pointsOfSale;
```

**Step 2: Register route in app**

In `apps/store/src/index.ts`:

1. Add import (after line ~18, with other route imports):
```typescript
import pointsOfSaleRoutes from "./routes/points-of-sale.js";
```

2. Add route registration (after line ~101, after `app.route("/api/uploads", uploads)`):
```typescript
app.route("/api/points-of-sale", pointsOfSaleRoutes);
```

**Step 3: Verify build**

Run: `cd apps/store && pnpm build`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add apps/store/src/routes/points-of-sale.ts apps/store/src/index.ts
git commit -m "feat: add points-of-sale API routes"
```

---

### Task 6: Backend — Update order service to include POS relation

**Files:**
- Modify: `apps/store/src/services/order.service.ts`

**Step 1: Add pointOfSale to order queries**

In `apps/store/src/services/order.service.ts`, find the two `with:` blocks in `listOrders` (around line 397) and `getOrderById` (around line 447). Add to each:

```typescript
        pointOfSale: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
```

**Step 2: Handle posId in order create/update**

Find the `createOrder` function. Where order values are built, add:
```typescript
      posId: data.posId ?? null,
```

Find the `updateOrder` function. In the field-by-field update section, add:
```typescript
  if (data.posId !== undefined) updateData.posId = data.posId;
```

**Step 3: Handle posId filter in listOrders**

In `listOrders`, where filter conditions are built, add:
```typescript
  if (filters.posId) {
    conditions.push(eq(orders.posId, filters.posId));
  }
```

**Step 4: Verify build**

Run: `cd apps/store && pnpm build`
Expected: SUCCESS

**Step 5: Commit**

```bash
git add apps/store/src/services/order.service.ts
git commit -m "feat: include pointOfSale relation in order queries and handle posId in create/update"
```

---

### Task 7: Frontend — API client functions

**Files:**
- Modify: `apps/client/lib/api.ts`

**Step 1: Add POS API functions**

Add at the end of `apps/client/lib/api.ts` (before the final closing, if any), the following functions:

```typescript
// ── Points of Sale ──

export type PointsOfSaleResponse = PaginatedResponse<PointOfSale>;

export async function fetchPointsOfSale(
  params?: Partial<PointOfSaleFilters>,
): Promise<PointsOfSaleResponse> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.type) searchParams.set("type", params.type);
  if (params?.isActive !== undefined)
    searchParams.set("isActive", String(params.isActive));
  const query = searchParams.toString();
  return fetchApi<PointsOfSaleResponse>(
    `/points-of-sale${query ? `?${query}` : ""}`,
  );
}

export async function fetchPointOfSale(id: string): Promise<PointOfSale> {
  return fetchApi<PointOfSale>(`/points-of-sale/${id}`);
}

export async function createPointOfSale(
  data: CreatePointOfSale,
): Promise<PointOfSale> {
  return fetchApi<PointOfSale>("/points-of-sale", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePointOfSale(
  id: string,
  data: UpdatePointOfSale,
): Promise<PointOfSale> {
  return fetchApi<PointOfSale>(`/points-of-sale/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deletePointOfSale(id: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/points-of-sale/${id}`, {
    method: "DELETE",
  });
}
```

Make sure the types are imported. Check if `api.ts` already re-exports from `@prepareos/data`. If so, the types (`PointOfSale`, `CreatePointOfSale`, etc.) should be available automatically. If not, add:

```typescript
import type {
  PointOfSale,
  CreatePointOfSale,
  UpdatePointOfSale,
  PointOfSaleFilters,
} from "@prepareos/data";
```

**Step 2: Verify build**

Run: `cd apps/client && pnpm build`
Expected: SUCCESS (or at least no type errors in api.ts)

**Step 3: Commit**

```bash
git add apps/client/lib/api.ts
git commit -m "feat: add points-of-sale API client functions"
```

---

### Task 8: Frontend — POS form component

**Files:**
- Create: `apps/client/components/forms/point-of-sale-form.tsx`

**Step 1: Create the form component**

Follow the exact pattern from `category-form.tsx`. Create `apps/client/components/forms/point-of-sale-form.tsx`:

The form should have these fields:
1. `name` — Input (required)
2. `type` — Select with options: "Point de retrait" (`pickup_location`) / "Point de vente permanent" (`permanent_pos`)
3. `description` — Textarea (optional)
4. `address` — Textarea (optional)
5. `phone` — Input (optional)
6. `sortOrder` — Number input
7. `isActive` — Switch

Include:
- `initialData?: PointOfSale` prop for edit mode
- Create and update mutations following category-form pattern
- Delete mutation with confirmation dialog in edit mode
- Redirects to `/points-of-sale` on success
- Query key: `["points-of-sale"]` for list, `["point-of-sale", id]` for single

**Step 2: Commit**

```bash
git add apps/client/components/forms/point-of-sale-form.tsx
git commit -m "feat: add point-of-sale form component"
```

---

### Task 9: Frontend — POS list page

**Files:**
- Create: `apps/client/app/points-of-sale/page.tsx`

**Step 1: Create the list page**

Follow the categories `page.tsx` pattern exactly. Key details:
- Query key: `["points-of-sale"]`
- Fetch: `fetchPointsOfSale({ limit: 50 })`
- Title: "Points de vente"
- Description: "Gérez vos points de vente et de retrait"
- Create button links to `/points-of-sale/create`
- Table columns: Nom, Type (badge), Adresse, Statut
- Type badges: "Point de retrait" with `bg-blue-100 text-blue-800`, "Point de vente" with `bg-purple-100 text-purple-800`
- Rows link to `/points-of-sale/[id]`

**Step 2: Commit**

```bash
git add apps/client/app/points-of-sale/page.tsx
git commit -m "feat: add points-of-sale list page"
```

---

### Task 10: Frontend — POS create page

**Files:**
- Create: `apps/client/app/points-of-sale/create/page.tsx`

**Step 1: Create the page**

Follow the categories `create/page.tsx` pattern:
- Title: "Nouveau point de vente"
- Description: "Ajoutez un point de vente ou de retrait"
- Back button to `/points-of-sale`
- Render `<PointOfSaleForm />`

**Step 2: Commit**

```bash
git add apps/client/app/points-of-sale/create/page.tsx
git commit -m "feat: add points-of-sale create page"
```

---

### Task 11: Frontend — POS edit page

**Files:**
- Create: `apps/client/app/points-of-sale/[id]/page.tsx`

**Step 1: Create the page**

Follow the categories `[id]/page.tsx` pattern:
- Query: `fetchPointOfSale(id)` with key `["point-of-sale", id]`
- Title: POS name
- Active/inactive badge
- Back button to `/points-of-sale`
- Render `<PointOfSaleForm initialData={pos} />`
- Loading skeleton + 404 handling

**Step 2: Commit**

```bash
git add apps/client/app/points-of-sale/\[id\]/page.tsx
git commit -m "feat: add points-of-sale edit page"
```

---

### Task 12: Frontend — Sidebar link

**Files:**
- Modify: `apps/client/components/app-sidebar.tsx`

**Step 1: Add POS to management navigation**

`Store` is already imported in the sidebar. Add to `managementNavigation` array (after "Equipe"):

```typescript
  {
    title: "Points de vente",
    url: "/points-of-sale",
    icon: Store,
    roles: ["admin", "owner"],
  },
```

**Note:** The `Store` icon is already imported at line 14 and used in the header logo. It's available for reuse. If you prefer a different icon like `MapPin`, import it and use that instead.

**Step 2: Commit**

```bash
git add apps/client/components/app-sidebar.tsx
git commit -m "feat: add points-of-sale link to sidebar"
```

---

### Task 13: Frontend — Add POS select to order create/edit pages

**Files:**
- Modify: `apps/client/app/orders/new/page.tsx`
- Modify: `apps/client/app/orders/[id]/page.tsx`

**Step 1: Add POS select to order creation page**

In `apps/client/app/orders/new/page.tsx`:

1. Import `fetchPointsOfSale` from `@/lib/api`
2. Add query to fetch active POS:
```typescript
const { data: posData } = useQuery({
  queryKey: ["points-of-sale", { isActive: true }],
  queryFn: () => fetchPointsOfSale({ isActive: true, limit: 100 }),
});
const pointsOfSale = posData?.data ?? [];
```

3. Add `posId` to the form's default values (null/undefined)
4. Add a POS select field in the order details section (near pickup date/time fields). Group options by type:
```tsx
<FormField
  control={form.control}
  name="posId"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Point de vente</FormLabel>
      <Select
        onValueChange={(v) => field.onChange(v === "none" ? null : v)}
        value={field.value ?? "none"}
      >
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Aucun" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="none">Aucun</SelectItem>
          {pointsOfSale
            .filter((p) => p.type === "permanent_pos")
            .length > 0 && (
            <SelectGroup>
              <SelectLabel>Points de vente</SelectLabel>
              {pointsOfSale
                .filter((p) => p.type === "permanent_pos")
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
            </SelectGroup>
          )}
          {pointsOfSale
            .filter((p) => p.type === "pickup_location")
            .length > 0 && (
            <SelectGroup>
              <SelectLabel>Points de retrait</SelectLabel>
              {pointsOfSale
                .filter((p) => p.type === "pickup_location")
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

5. Make sure `posId` is included in the submit data sent to the API.

**Step 2: Add POS select to order edit page**

In `apps/client/app/orders/[id]/page.tsx`, apply the same pattern:
1. Fetch active POS
2. Add POS select field (pre-populated with `order.posId`)
3. Include `posId` in the update mutation payload

**Step 3: Commit**

```bash
git add apps/client/app/orders/new/page.tsx apps/client/app/orders/\[id\]/page.tsx
git commit -m "feat: add POS select to order create and edit pages"
```

---

### Task 14: Frontend — Show POS badge on preparation OrderRow

**Files:**
- Modify: `apps/client/app/preparation/components/OrderRow.tsx`

**Step 1: Display POS name badge**

In `OrderRow.tsx`, in the "Commande" section (col-span-6), add a small badge showing the POS name when assigned. Add it after the pickup time span, inside the first `flex items-center gap-3` div:

```tsx
{order.pointOfSale && (
  <span className="text-xs flex items-center gap-1 shrink-0">
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
      {order.pointOfSale.name}
    </Badge>
  </span>
)}
```

Import `Badge` if not already imported.

**Step 2: Commit**

```bash
git add apps/client/app/preparation/components/OrderRow.tsx
git commit -m "feat: show POS badge on preparation order rows"
```

---

### Task 15: Verification — Full build + manual test

**Step 1: Full build**

Run: `pnpm build` (from root, runs turborepo build for all packages)
Expected: SUCCESS for all packages

**Step 2: Start dev servers**

Run: `pnpm dev` (from root)

**Step 3: Manual verification checklist**

- [ ] Navigate to `/points-of-sale` — list page loads, shows empty state
- [ ] Click "Nouveau point de vente" — form loads with all fields
- [ ] Create a pickup location — redirects to list, new entry visible
- [ ] Create a permanent POS — appears in list with correct type badge
- [ ] Click an entry — edit page loads with pre-filled form
- [ ] Update name — saves successfully
- [ ] Toggle isActive — saves successfully
- [ ] Delete a POS with no orders — succeeds
- [ ] Sidebar shows "Points de vente" for admin/owner users
- [ ] Navigate to `/orders/new` — POS select dropdown appears, grouped by type
- [ ] Create order with POS assigned — saves correctly
- [ ] Edit order, change POS — saves correctly
- [ ] Preparation page shows POS badge on order rows

**Step 4: Final commit (if any fixes needed)**

```bash
git commit -m "fix: address issues found during manual testing"
```
