# Admin Dashboard Restructure

## Summary

Restructure the admin dashboard to support per-tenant detail pages, tenant creation, owner management, and platform admin management. Move SMS credit attribution from a flat global page into individual tenant pages. Add admin user management at `/admin/users`.

## Current State

- `/admin` — flat tenant list table (read-only)
- `/admin/sms` — global SMS credit management for all tenants
- `/admin/login` — platform admin login (email/password)
- `/login` — tenant-scoped login (staff PIN grid + email/password labeled "Connexion admin")
- No tenant creation UI (done manually)
- No admin user management UI (done via dev-signup only)
- No owner management UI

## Changes

### 1. Backend API Routes

All routes in `apps/store/src/routes/admin.ts`, guarded by `adminOnly` middleware.

#### Tenant CRUD

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/admin/tenants` | Create tenant with `{ name, slug }` |
| `GET` | `/api/admin/tenants/:tenantId` | Get single tenant with owner count and SMS balance |

- Slug validated for uniqueness and against reserved subdomains (`api`, `admin`, `www`, `app`, `mail`)
- Slug format: lowercase alphanumeric + hyphens only (`/^[a-z0-9-]+$/`)
- Tenant existence validated on all `/tenants/:tenantId/*` routes — return 404 if not found

#### Owner Management

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/tenants/:tenantId/owners` | List owners for a tenant |
| `POST` | `/api/admin/tenants/:tenantId/owners` | Create owner (name, email, password) |
| `PATCH` | `/api/admin/tenants/:tenantId/owners/:userId` | Toggle owner active status |

- Owner creation uses Better Auth `createUser` API (handles password hashing)
- Email uniqueness validated before creation — return user-friendly French error if duplicate
- Created with `role: "owner"` and `tenantId` set to the tenant
- Activate/deactivate toggles `isActive` — preserves audit trail

#### Platform Admin Management

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/users` | List platform admins (`role: "admin"`, `tenantId: null`) |
| `POST` | `/api/admin/users` | Create platform admin (name, email, password) |
| `PATCH` | `/api/admin/users/:userId` | Update admin (name, email) |
| `DELETE` | `/api/admin/users/:userId` | Deactivate admin (soft delete) |

- Email uniqueness validated before creation — return user-friendly French error if duplicate
- Self-deletion protection: cannot deactivate your own account
- Created with `role: "admin"` and `tenantId: null`

#### Existing SMS Routes

Unchanged — `/api/admin/sms/tenants/:tenantId/grant`, `/revoke`, `/transactions` stay as-is. They're just accessed from the tenant detail page now.

### 2. Validation Schemas

Added to `@prepareos/data` package:

```typescript
// Tenant creation
createTenantSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/),
})

// Owner creation
createOwnerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

// Admin creation (same shape)
createAdminSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})
```

### 3. Frontend Pages

#### `/admin` (Tenants list — modified)

- Add "Creer un tenant" button opening a dialog form:
  - Name field (required)
  - Slug field (auto-generated from name, editable)
  - Auto-generation: lowercase, strip accents, spaces/special chars to hyphens
- Table rows become links to `/admin/tenants/:tenantId`

#### `/admin/tenants/:tenantId` (new)

Tenant detail page with three tabs:

**Informations tab:**
- Read-only display: name, slug, preparation filter days, created date

**SMS tab:**
- OVH platform credit balance + available-to-distribute count (so admin knows how many credits can be granted)
- Tenant SMS credit balance display
- Grant credits form (amount + optional description)
- Revoke credits form (amount + optional description)
- Transaction history table (date, type, amount, description, admin name via user join)

**Proprietaires tab:**
- Table: name, email, active status, created date
- "Ajouter un proprietaire" button → dialog form (name, email, password)
- Row action: deactivate/reactivate owner

#### `/admin/users` (new)

Platform admin management:

- Table: name, email, active status, created date
- "Ajouter un admin" button → dialog form (name, email, password)
- Row actions: edit (name/email), deactivate/reactivate
- Cannot deactivate yourself (button disabled)

#### `/admin/sms` (removed)

Delete page. Content moved into per-tenant detail pages.

#### Admin Navigation (layout update)

Change nav items from: **Tenants** | **SMS**
To: **Tenants** | **Administrateurs**

Update active state logic: Tenants tab highlights when `pathname === "/admin" || pathname.startsWith("/admin/tenants")`.

#### `/login` (label change)

Change the mode toggle button text from "Connexion admin" to "Connexion proprietaire" and the card description from "Connexion administrateur" to "Connexion proprietaire". Both refer to the email/password login form for tenant owners.

### 4. Security

- All admin routes use existing `adminOnly` middleware
- Password hashing via Better Auth `createUser` (bcrypt)
- Self-deletion protection on admin deactivation (server-side check)
- Slug uniqueness enforced at DB level (existing unique constraint) and validated server-side against reserved subdomains
- Soft deactivation (`isActive: false`) preserves referential integrity with SMS transactions, orders, etc.
- Deactivated users cannot log in — verify that auth middleware checks `isActive` on session validation; if not, add the check
- Deactivation/reactivation actions require a confirmation dialog ("Etes-vous sur ?")
- Password forms show "8 caracteres minimum" hint

### 5. UI Patterns

All new UI follows existing codebase patterns:
- shadcn Dialog for create/edit forms
- react-hook-form for form handling
- TanStack Query for data fetching and mutations
- `queryClient.invalidateQueries` on mutation success
- Toast notifications for success/error feedback
- French labels throughout (matching existing UI language)

### 6. Files Changed

**New files:**
- `apps/client/app/(admin)/admin/(authenticated)/tenants/[tenantId]/page.tsx` — tenant detail page
- `apps/client/app/(admin)/admin/(authenticated)/users/page.tsx` — admin management page

**Modified files:**
- `apps/store/src/routes/admin.ts` — add tenant CRUD, owner CRUD, admin CRUD routes
- `apps/client/app/(admin)/admin/(authenticated)/page.tsx` — add create tenant button, link rows
- `apps/client/app/(admin)/admin/(authenticated)/layout.tsx` — update nav items
- `apps/client/app/login/page.tsx` — change label to "Connexion proprietaire"
- `apps/client/lib/api.ts` — add API client functions for new routes
- `packages/data/src/schema/tenants.ts` — add Zod validation schemas (or new validation file)

**Deleted files:**
- `apps/client/app/(admin)/admin/(authenticated)/sms/page.tsx` — content moved to tenant detail
