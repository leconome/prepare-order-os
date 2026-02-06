# Multi-Tenancy Migration Assessment

## Current state

The app has **zero tenant awareness**. Every table, every query, every route operates on a single shared dataset.

| What exists | Count | Tenant-aware? |
|---|---|---|
| Database tables | 8 business + 4 auth | None |
| DB queries across all services | ~47 | None |
| Route files | 8 | None |
| Public (unauthenticated) endpoints | 3 | None |

---

## What needs to change

### 1. New tables

```
tenants
├── id (uuid, PK)
├── name ("Boulangerie Martin")
├── slug ("boulangerie-martin") — used in subdomain
├── createdAt
└── updatedAt
```

No separate `tenant_memberships` table needed — a user belongs to exactly one tenant (a staff member works at one store). Just add `tenantId` to the `users` table.

### 2. Add `tenantId` to every business table

| Table | Change | Notes |
|---|---|---|
| `users` | Add `tenantId` (FK → tenants, NOT NULL) | Better Auth user extension |
| `clients` | Add `tenantId` | Customer contacts |
| `categories` | Add `tenantId` | Self-referencing tree — filter at root |
| `products` | Add `tenantId` | |
| `menus` | Add `tenantId` | |
| `menuProducts` | No change needed | Already scoped via menu FK |
| `orders` | Add `tenantId` | Most critical — financial data |
| `orderItems` | No change needed | Already scoped via order FK (cascade delete) |
| `ticketCounters` | Add `tenantId` to composite PK | Currently `(dateKey)` → becomes `(tenantId, dateKey)` |

**Total: 7 tables get a new column. 2 join/child tables are implicitly scoped.**

### 3. Tenant context extraction

The cleanest approach: **subdomain-based tenant resolution**.

```
client-a.prepareos.com → tenant slug = "client-a"
client-b.prepareos.com → tenant slug = "client-b"
```

A single middleware at the top of the Hono stack:

```typescript
// Simplified concept
app.use("*", async (c, next) => {
  const host = c.req.header("host");           // "client-a.prepareos.com"
  const slug = host?.split(".")[0];             // "client-a"
  const tenant = await getTenantBySlug(slug);   // DB lookup (cached)
  c.set("tenant", tenant);
  await next();
});
```

Every downstream route/service gets `tenantId` from context. No URL changes, no header tricks.

### 4. Query changes (~47 queries)

Every `findMany`, `findFirst`, `insert`, `update`, `delete` needs scoping:

```typescript
// Before
const products = await db.query.products.findMany({
  where: eq(products.isActive, true),
});

// After
const products = await db.query.products.findMany({
  where: and(
    eq(products.tenantId, tenantId),
    eq(products.isActive, true),
  ),
});
```

For inserts:
```typescript
// Before
await db.insert(products).values({ name, price, ... });

// After
await db.insert(products).values({ name, price, tenantId, ... });
```

This is repetitive but straightforward. Each service file gets a `tenantId` parameter added to every function.

### 5. Auth changes

**Better Auth** needs to know about `tenantId` on the user:

```typescript
user: {
  additionalFields: {
    role: { type: "string", required: false, defaultValue: "staff" },
    tenantId: { type: "string", required: true },  // NEW
  },
},
```

**Auth middleware** adds `tenantId` to the user context:

```typescript
export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  tenantId: string;  // NEW
};
```

### 6. Login flow changes (the UX question you raised)

**Current flow:**
1. User hits `app.prepareos.com/login`
2. App calls `GET /users/login-staff` → returns ALL staff
3. User picks their name, enters PIN

**Multi-tenant flow:**
1. User hits `client-a.prepareos.com/login`
2. Subdomain middleware resolves `client-a` → tenant
3. App calls `GET /users/login-staff` → returns staff **for that tenant only**
4. User picks their name, enters PIN

The login page **already shows employees from the get-go** — that's the StaffGrid component. With multi-tenancy, it automatically shows only the right tenant's employees because the API is tenant-scoped. No UX change needed, it just works.

The only thing to handle: what if someone hits the root domain (`prepareos.com`) with no subdomain? Redirect to a tenant selection page, or to a "contact us" page.

---

## What does NOT need to change

- **Dockerfiles** — identical, same images for all tenants
- **docker-compose** — one stack total (not one per client anymore)
- **Caddy** — wildcard `*.prepareos.com` pointing to same backend
- **Frontend components** — they already call the API, which will be tenant-scoped
- **`api.ts`** — no changes needed if tenant is resolved from subdomain (the browser sends the right Host header automatically)
- **menuProducts / orderItems** — implicitly scoped through parent FK

---

## Effort estimate

| Phase | Work | Days |
|---|---|---|
| **Schema + migrations** | Create `tenants` table, add `tenantId` to 7 tables, update ticketCounter PK, generate Drizzle migrations | 1-2 |
| **Tenant middleware** | Subdomain extraction, DB lookup, caching, set on context | 0.5 |
| **Auth integration** | Extend Better Auth user with `tenantId`, update auth middleware, update signup flow | 1-2 |
| **Service layer** | Add `tenantId` param to all service functions, update 47 queries with WHERE/insert scoping | 3-4 |
| **Route layer** | Extract `tenantId` from context in every route handler, pass to services | 1 |
| **Login endpoints** | Scope `login-staff` and `login-pin` to tenant, handle root domain redirect | 0.5 |
| **Seed/dev tooling** | Update seed script to create a default tenant, update dev-signup | 0.5 |
| **Testing** | Verify isolation (create 2 tenants, check no data leaks), test edge cases | 1-2 |

**Total: 8-12 days** for one developer who knows the codebase.

This is less than the ~20 day estimate for a generic migration because:
- The schema is simple (no deeply nested multi-tenant hierarchies)
- Services are cleanly separated (one file per entity)
- The query pattern is repetitive (add `tenantId` to WHERE, done)
- Subdomain routing avoids any frontend API changes

---

## Risk areas

### 1. Better Auth tenant extension
Better Auth's `additionalFields` may or may not support required fields cleanly during signup. May need to use the internal adapter to set `tenantId` after user creation.

**Mitigation**: Test early. If `additionalFields` doesn't work, add `tenantId` to users table manually and bypass Better Auth's schema for that column.

### 2. PIN uniqueness
Currently PINs are not unique-constrained in the DB (checked via query). With multi-tenancy, two staff members in different tenants can have the same PIN — this is fine and expected. But within a tenant, PINs should remain unique.

**Mitigation**: Add a unique composite index `(tenantId, pin)` where pin is not null.

### 3. Ticket counter
Currently uses `dateKey` as PK. Needs to become `(tenantId, dateKey)`.

**Mitigation**: Straightforward schema change. The upsert logic just adds `tenantId` to the conflict target.

### 4. Forgetting a WHERE clause
The #1 risk in multi-tenant apps. One missed `tenantId` filter = data leak between tenants.

**Mitigation**:
- Create a helper like `withTenant(tenantId)` that returns the WHERE condition
- Consider Drizzle's `.prepare()` pattern or a wrapper that enforces tenant filtering
- Add an integration test that creates 2 tenants with identical data and verifies isolation on every endpoint

---

## Deployment impact: before vs after

### Before (per-client stacks from DOCKER_PLAN.md)

```
Per client: 3 containers (db + store + client)
10 clients = 30 containers + Caddy + Portainer + Uptime Kuma
RAM: ~4-8 GB
Adding a client: copy folder, edit env, update Caddy, run migrations
```

### After (multi-tenant)

```
Total: 4 containers (db + store + client + caddy)
10 clients = still 4 containers
RAM: ~500 MB total
Adding a client: INSERT into tenants table, point DNS
```

The entire deployment section of DOCKER_PLAN.md simplifies to:

```yaml
services:
  db:
    image: postgres:15-alpine
    # ...single instance

  store:
    image: ghcr.io/YOUR_USER/prepareos-store:latest
    # ...single instance

  client:
    image: ghcr.io/YOUR_USER/prepareos-client:latest
    # ...single instance

  caddy:
    image: caddy:2-alpine
    # ...wildcard *.prepareos.com
```

```caddyfile
*.prepareos.com {
    handle /api/* {
        reverse_proxy store:9000
    }
    handle {
        reverse_proxy client:3000
    }
}
```

No deploy.sh loop. No per-client compose files. No per-client env files. One deploy updates everyone.

---

## Recommendation

**Do the multi-tenant migration now, before your first paying client.**

- 8-12 days of work now saves you from managing N infrastructure stacks forever
- The codebase is small and clean — the migration is mechanical, not architectural
- Retrofitting later (after 10 clients with separate DBs) would require merging databases, resolving ID conflicts, and rewriting the deployment pipeline
- The login UX you want (show employees immediately) works naturally with subdomain-based tenant resolution

The DOCKER_PLAN.md Dockerfiles and GitHub Actions workflow remain valid — only the VPS deployment section changes (dramatically simplifies).
