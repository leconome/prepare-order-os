# Admin Dashboard Restructure Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure admin dashboard with per-tenant detail pages (SMS + owner management), platform admin management, and tenant creation.

**Architecture:** Add new admin API routes for tenant CRUD, owner CRUD, and platform admin CRUD to `apps/store/src/routes/admin.ts`. Add two new frontend pages (tenant detail + admin users). Modify existing admin dashboard page and layout. All following existing patterns (Hono + Drizzle backend, Next.js + TanStack Query frontend, shadcn UI).

**Tech Stack:** Hono, Drizzle ORM, Better Auth, Next.js, React 19, TanStack Query, shadcn/ui, react-hook-form, Zod

**Spec:** `docs/superpowers/specs/2026-03-13-admin-dashboard-restructure-design.md`

---

## File Structure

**New files:**
- `apps/client/app/(admin)/admin/(authenticated)/tenants/[tenantId]/page.tsx` — tenant detail page (SMS + owners tabs)
- `apps/client/app/(admin)/admin/(authenticated)/users/page.tsx` — platform admin management page

**Modified files:**
- `packages/data/src/schema/tenants.ts` — add `createOwnerSchema`, `createAdminSchema` Zod schemas
- `apps/store/src/routes/admin.ts` — add tenant CRUD, owner CRUD, admin CRUD routes
- `apps/client/lib/api.ts` — add API client functions for new routes
- `apps/client/app/(admin)/admin/(authenticated)/page.tsx` — add create tenant dialog, link rows to detail
- `apps/client/app/(admin)/admin/(authenticated)/layout.tsx` — update nav items and active state
- `apps/client/app/login/page.tsx` — change "Connexion admin" labels to "Connexion proprietaire"

**Deleted files:**
- `apps/client/app/(admin)/admin/(authenticated)/sms/page.tsx` — content moves to tenant detail

---

## Chunk 1: Backend — Validation Schemas + API Routes

### Task 1: Add Zod validation schemas to `@prepareos/data`

**Files:**
- Modify: `packages/data/src/schema/tenants.ts`

- [ ] **Step 1: Add owner and admin creation schemas**

In `packages/data/src/schema/tenants.ts`, add after the existing `updateTenantSettingsSchema`:

```typescript
// Owner creation (admin creates owner for a tenant)
export const createOwnerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});
export type CreateOwner = z.infer<typeof createOwnerSchema>;

// Platform admin creation
export const createAdminSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});
export type CreateAdmin = z.infer<typeof createAdminSchema>;

// Update admin schema
export const updateAdminSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
});
export type UpdateAdmin = z.infer<typeof updateAdminSchema>;
```

- [ ] **Step 2: Verify build**

Run: `cd packages/data && pnpm build`
Expected: Build succeeds, new schemas are exported.

- [ ] **Step 3: Commit**

```bash
git add packages/data/src/schema/tenants.ts
git commit -m "feat: add owner, admin creation and update Zod schemas"
```

---

### Task 2: Add tenant CRUD routes

**Files:**
- Modify: `apps/store/src/routes/admin.ts`

- [ ] **Step 1: Add imports for new schemas and drizzle utilities**

At the top of `apps/store/src/routes/admin.ts`, update imports:

```typescript
import { zValidator } from "@hono/zod-validator";
import {
  createOwnerSchema,
  createAdminSchema,
  createTenantSchema,
  updateAdminSchema,
  grantCreditsSchema,
  revokeCreditsSchema,
  smsCreditFiltersSchema,
  tenants,
} from "@prepareos/data";
import { users } from "@prepareos/data/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/index.js";
import { auth } from "../lib/auth.js";
import { authMiddleware } from "../middleware/auth.js";
import { adminOnly } from "../middleware/role-guard.js";
import * as smsService from "../services/sms.service.js";
import type { AppEnv } from "../types.js";
```

- [ ] **Step 2: Add reserved subdomains constant and POST /tenants route**

Add after the `admin.use("*", adminOnly)` line, before the existing GET `/tenants` route:

```typescript
const RESERVED_SUBDOMAINS = ["api", "admin", "www", "app", "mail"];

// POST /api/admin/tenants — create a new tenant
admin.post(
  "/tenants",
  zValidator("json", createTenantSchema),
  async (c) => {
    const { name, slug } = c.req.valid("json");

    // Validate slug is not reserved
    if (RESERVED_SUBDOMAINS.includes(slug)) {
      return c.json({ error: "Ce slug est réservé et ne peut pas être utilisé" }, 400);
    }

    // Check slug uniqueness
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (existing) {
      return c.json({ error: "Ce slug est déjà utilisé par un autre tenant" }, 409);
    }

    const [tenant] = await db
      .insert(tenants)
      .values({ name, slug })
      .returning();

    return c.json({ data: tenant }, 201);
  },
);
```

- [ ] **Step 3: Add GET /tenants/:tenantId route**

Add after the POST `/tenants` route:

```typescript
// GET /api/admin/tenants/:tenantId — get single tenant with owner count
admin.get("/tenants/:tenantId", async (c) => {
  const tenantId = c.req.param("tenantId");

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant) {
    return c.json({ error: "Tenant non trouvé" }, 404);
  }

  const [ownerCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.tenantId, tenantId), eq(users.role, "owner")));

  return c.json({
    data: {
      ...tenant,
      ownerCount: Number(ownerCount?.count ?? 0),
    },
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/store/src/routes/admin.ts
git commit -m "feat: add tenant CRUD admin routes (create + get single)"
```

---

### Task 3: Add owner management routes

**Files:**
- Modify: `apps/store/src/routes/admin.ts`

- [ ] **Step 1: Add owner CRUD routes**

Add after the GET `/tenants/:tenantId` route, before the SMS endpoints section:

```typescript
// ── Owner Management ────────────────────────────────

// GET /api/admin/tenants/:tenantId/owners — list owners for a tenant
admin.get("/tenants/:tenantId/owners", async (c) => {
  const tenantId = c.req.param("tenantId");

  // Verify tenant exists
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });
  if (!tenant) {
    return c.json({ error: "Tenant non trouvé" }, 404);
  }

  const owners = await db.query.users.findMany({
    where: and(eq(users.tenantId, tenantId), eq(users.role, "owner")),
    columns: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({ data: owners });
});

// POST /api/admin/tenants/:tenantId/owners — create owner
admin.post(
  "/tenants/:tenantId/owners",
  zValidator("json", createOwnerSchema),
  async (c) => {
    const tenantId = c.req.param("tenantId");
    const { name, email, password } = c.req.valid("json");

    // Verify tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });
    if (!tenant) {
      return c.json({ error: "Tenant non trouvé" }, 404);
    }

    // Check email uniqueness globally
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return c.json({ error: "Un utilisateur avec cet email existe déjà" }, 409);
    }

    try {
      const result = await auth.api.signUpEmail({
        body: { email, password, name, tenantId },
      });

      if (!result.user) {
        return c.json({ error: "Échec de la création du propriétaire" }, 500);
      }

      // Set role to owner
      await db
        .update(users)
        .set({ role: "owner", tenantId })
        .where(eq(users.id, result.user.id));

      const owner = await db.query.users.findFirst({
        where: eq(users.id, result.user.id),
        columns: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });

      return c.json({ data: owner }, 201);
    } catch (error) {
      console.error("Failed to create owner:", error);
      return c.json({ error: "Échec de la création du propriétaire" }, 500);
    }
  },
);

// PATCH /api/admin/tenants/:tenantId/owners/:userId — toggle owner active status
admin.patch("/tenants/:tenantId/owners/:userId", async (c) => {
  const tenantId = c.req.param("tenantId");
  const userId = c.req.param("userId");

  const owner = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.tenantId, tenantId),
      eq(users.role, "owner"),
    ),
  });

  if (!owner) {
    return c.json({ error: "Propriétaire non trouvé" }, 404);
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: !owner.isActive, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return c.json({ data: updated });
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/store/src/routes/admin.ts
git commit -m "feat: add owner management admin routes (list, create, toggle active)"
```

---

### Task 4: Add platform admin management routes

**Files:**
- Modify: `apps/store/src/routes/admin.ts`

- [ ] **Step 1: Add admin user CRUD routes**

Add after the owner management routes:

```typescript
// ── Platform Admin Management ────────────────────────────────

// GET /api/admin/users — list platform admins
admin.get("/users", async (c) => {
  const admins = await db.query.users.findMany({
    where: and(eq(users.role, "admin"), isNull(users.tenantId)),
    columns: {
      id: true,
      name: true,
      email: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });

  return c.json({ data: admins });
});

// POST /api/admin/users — create platform admin
admin.post(
  "/users",
  zValidator("json", createAdminSchema),
  async (c) => {
    const { name, email, password } = c.req.valid("json");

    // Check email uniqueness
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return c.json({ error: "Un utilisateur avec cet email existe déjà" }, 409);
    }

    try {
      const result = await auth.api.signUpEmail({
        body: { email, password, name },
      });

      if (!result.user) {
        return c.json({ error: "Échec de la création de l'administrateur" }, 500);
      }

      // Set role to admin, ensure no tenantId
      await db
        .update(users)
        .set({ role: "admin", tenantId: null })
        .where(eq(users.id, result.user.id));

      const admin = await db.query.users.findFirst({
        where: eq(users.id, result.user.id),
        columns: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });

      return c.json({ data: admin }, 201);
    } catch (error) {
      console.error("Failed to create admin:", error);
      return c.json({ error: "Échec de la création de l'administrateur" }, 500);
    }
  },
);

// PATCH /api/admin/users/:userId — update admin
admin.patch(
  "/users/:userId",
  zValidator("json", updateAdminSchema),
  async (c) => {
    const userId = c.req.param("userId");
    const data = c.req.valid("json");

    const existing = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.role, "admin"),
        isNull(users.tenantId),
      ),
    });

    if (!existing) {
      return c.json({ error: "Administrateur non trouvé" }, 404);
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) {
      // Check email uniqueness
      const emailTaken = await db.query.users.findFirst({
        where: and(eq(users.email, data.email)),
      });
      if (emailTaken && emailTaken.id !== userId) {
        return c.json({ error: "Cet email est déjà utilisé" }, 409);
      }
      updateData.email = data.email;
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return c.json({ data: updated });
  },
);

// DELETE /api/admin/users/:userId — deactivate admin (soft delete)
admin.delete("/users/:userId", async (c) => {
  const userId = c.req.param("userId");
  const currentUser = c.get("user");

  // Self-deletion protection
  if (currentUser.id === userId) {
    return c.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, 400);
  }

  const existing = await db.query.users.findFirst({
    where: and(
      eq(users.id, userId),
      eq(users.role, "admin"),
      isNull(users.tenantId),
    ),
  });

  if (!existing) {
    return c.json({ error: "Administrateur non trouvé" }, 404);
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      isActive: users.isActive,
      createdAt: users.createdAt,
    });

  return c.json({ data: updated });
});
```

- [ ] **Step 2: Verify backend builds**

Run: `cd apps/store && pnpm build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/store/src/routes/admin.ts
git commit -m "feat: add platform admin management routes (list, create, update, deactivate)"
```

---

### Task 5: Verify isActive check in auth middleware

**Files:**
- Modify (if needed): `apps/store/src/middleware/auth.ts`

- [ ] **Step 1: Check if auth middleware validates isActive**

Read `apps/store/src/middleware/auth.ts` and verify that after resolving the session, it checks `user.isActive !== false`. The current middleware does NOT check `isActive` — it only checks session validity and tenant matching.

- [ ] **Step 2: Add isActive check if missing**

In `authMiddleware`, after the session lookup succeeds and before setting the user on context, add:

```typescript
  // Block deactivated users
  const isActive = user.isActive as boolean | undefined;
  if (isActive === false) {
    return c.json({ error: "Account deactivated" }, 403);
  }
```

Add this block right after `const userTenantId = (user.tenantId as string) ?? null;` and before the cross-tenant guard.

- [ ] **Step 3: Commit**

```bash
git add apps/store/src/middleware/auth.ts
git commit -m "fix: block deactivated users from accessing authenticated routes"
```

---

## Chunk 2: Frontend — API Client + Admin Layout + Login Label

### Task 6: Add API client functions

**Files:**
- Modify: `apps/client/lib/api.ts`

- [ ] **Step 1: Add types and functions for new admin routes**

In `apps/client/lib/api.ts`, add after the existing `fetchAllTenants` function (in the `// ============ ADMIN ============` section):

```typescript
export type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  createdAt: string;
};

// Create tenant
export async function createTenant(data: {
  name: string;
  slug: string;
}): Promise<{ data: Tenant }> {
  return fetchApi("/admin/tenants", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Get single tenant
export async function fetchTenant(
  tenantId: string,
): Promise<{ data: Tenant & { ownerCount: number } }> {
  return fetchApi(`/admin/tenants/${tenantId}`);
}

// List owners for a tenant
export async function fetchTenantOwners(
  tenantId: string,
): Promise<{ data: AdminUser[] }> {
  return fetchApi(`/admin/tenants/${tenantId}/owners`);
}

// Create owner for a tenant
export async function createTenantOwner(
  tenantId: string,
  data: { name: string; email: string; password: string },
): Promise<{ data: AdminUser }> {
  return fetchApi(`/admin/tenants/${tenantId}/owners`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Toggle owner active status
export async function toggleOwnerActive(
  tenantId: string,
  userId: string,
): Promise<{ data: AdminUser }> {
  return fetchApi(`/admin/tenants/${tenantId}/owners/${userId}`, {
    method: "PATCH",
  });
}

// List platform admins
export async function fetchAdminUsers(): Promise<{ data: AdminUser[] }> {
  return fetchApi("/admin/users");
}

// Create platform admin
export async function createAdminUser(data: {
  name: string;
  email: string;
  password: string;
}): Promise<{ data: AdminUser }> {
  return fetchApi("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Update platform admin
export async function updateAdminUser(
  userId: string,
  data: { name?: string; email?: string },
): Promise<{ data: AdminUser }> {
  return fetchApi(`/admin/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Toggle admin active status (deactivate/reactivate)
export async function toggleAdminActive(
  userId: string,
): Promise<{ data: AdminUser }> {
  return fetchApi(`/admin/users/${userId}`, {
    method: "DELETE",
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/lib/api.ts
git commit -m "feat: add API client functions for tenant, owner, and admin management"
```

---

### Task 7: Update admin layout navigation

**Files:**
- Modify: `apps/client/app/(admin)/admin/(authenticated)/layout.tsx`

- [ ] **Step 1: Update NAV_ITEMS and active state logic**

In `layout.tsx`, replace the `NAV_ITEMS` array and update the icon imports:

Replace the import line:
```typescript
import { LogOut, MessageSquare, Shield, Store } from "lucide-react";
```
with:
```typescript
import { LogOut, Shield, ShieldCheck, Store } from "lucide-react";
```

Replace the `NAV_ITEMS` array:
```typescript
const NAV_ITEMS = [
  { href: "/admin", label: "Tenants", icon: Store },
  { href: "/admin/users", label: "Administrateurs", icon: ShieldCheck },
];
```

Update the `isActive` logic inside the `nav` mapping. Replace:
```typescript
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
```
with:
```typescript
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin" || pathname.startsWith("/admin/tenants")
                : pathname.startsWith(item.href);
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/app/(admin)/admin/(authenticated)/layout.tsx
git commit -m "feat: update admin nav — replace SMS with Administrateurs, fix active state"
```

---

### Task 8: Update login page labels

**Files:**
- Modify: `apps/client/app/login/page.tsx`

- [ ] **Step 1: Change "Connexion admin" to "Connexion proprietaire"**

In `apps/client/app/login/page.tsx`, find and replace these two strings:

1. Find `"Connexion administrateur"` (in the CardDescription around line 514) and replace with `"Connexion propriétaire"`.

2. Find `Connexion admin` (in the toggle button around line 598) and replace with `Connexion propriétaire`.

- [ ] **Step 2: Commit**

```bash
git add apps/client/app/login/page.tsx
git commit -m "feat: change login labels from Connexion admin to Connexion propriétaire"
```

---

## Chunk 3: Frontend — Admin Dashboard Page (tenant creation + links)

### Task 9: Add create tenant dialog and link rows on admin page

**Files:**
- Modify: `apps/client/app/(admin)/admin/(authenticated)/page.tsx`

- [ ] **Step 1: Rewrite the admin page with create tenant dialog and linked rows**

Replace the entire content of `apps/client/app/(admin)/admin/(authenticated)/page.tsx` with:

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createTenantSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Store } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createTenant, fetchAllTenants, formatDate } from "@/lib/api";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: "", slug: "" },
  });

  const name = form.watch("name");

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited) {
      form.setValue("slug", slugify(name));
    }
  }, [name, slugManuallyEdited, form]);

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); mutation.reset(); setSlugManuallyEdited(false); } }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Créer un tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouveau tenant</DialogTitle>
          <DialogDescription>
            Créez un nouveau tenant pour la plateforme.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="La Fromagerie du Coin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="la-fromagerie-du-coin"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setSlugManuallyEdited(true);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Sous-domaine du tenant (ex: {field.value || "mon-tenant"}.prepareos.fr)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur lors de la création"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: fetchAllTenants,
  });

  const tenants = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground">Gestion de la plateforme</p>
        </div>
        <CreateTenantDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>
            Liste de tous les tenants de la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-muted-foreground">
              Erreur lors du chargement des tenants
            </div>
          ) : tenants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun tenant trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Filtre préparation</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {tenant.slug}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenant.preparationFilterDays} jour{tenant.preparationFilterDays !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tenant.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/app/(admin)/admin/(authenticated)/page.tsx
git commit -m "feat: add create tenant dialog and link tenant rows to detail page"
```

---

## Chunk 4: Frontend — Tenant Detail Page

### Task 10: Create tenant detail page

**Files:**
- Create: `apps/client/app/(admin)/admin/(authenticated)/tenants/[tenantId]/page.tsx`

- [ ] **Step 1: Create the directory**

Run: `mkdir -p apps/client/app/\(admin\)/admin/\(authenticated\)/tenants/\[tenantId\]`

- [ ] **Step 2: Create the tenant detail page**

Create `apps/client/app/(admin)/admin/(authenticated)/tenants/[tenantId]/page.tsx`:

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createOwnerSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminUser,
  type SmsTenant,
  createTenantOwner,
  fetchAdminSmsCredits,
  fetchAdminSmsTenants,
  fetchAdminTenantTransactions,
  fetchTenant,
  fetchTenantOwners,
  formatDate,
  grantSmsCredits,
  revokeSmsCredits,
  toggleOwnerActive,
} from "@/lib/api";

// ============ INFORMATIONS TAB ============

function InformationsTab({ tenant }: { tenant: { name: string; slug: string; preparationFilterDays: number; smsCredits: number; ownerCount: number; createdAt: string } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Nom</dt>
            <dd className="text-sm">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
            <dd className="text-sm">
              <Badge variant="outline" className="font-mono text-xs">
                {tenant.slug}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Filtre préparation</dt>
            <dd className="text-sm">
              {tenant.preparationFilterDays} jour{tenant.preparationFilterDays !== 1 ? "s" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Créé le</dt>
            <dd className="text-sm">{formatDate(tenant.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Crédits SMS</dt>
            <dd className="text-sm font-mono">{tenant.smsCredits}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Propriétaires</dt>
            <dd className="text-sm">{tenant.ownerCount}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

// ============ SMS TAB ============

function SmsTab({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "grant" | "revoke";
  }>({ open: false, mode: "grant" });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const { data: ovhCredits, isLoading: ovhLoading } = useQuery({
    queryKey: ["admin-sms-credits"],
    queryFn: fetchAdminSmsCredits,
  });

  const { data: tenantsData } = useQuery({
    queryKey: ["admin-sms-tenants"],
    queryFn: fetchAdminSmsTenants,
  });

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: ["admin-tenant-transactions", tenantId],
    queryFn: () => fetchAdminTenantTransactions(tenantId, { limit: 50 }),
  });

  const thisTenant = tenantsData?.data?.find((t) => t.id === tenantId);
  const totalDistributed = tenantsData?.totalDistributed ?? 0;
  const available = tenantsData?.available;
  const maxGrant = available ?? undefined;
  const grantDisabled = available != null && available <= 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        amount: Number(amount),
        description: description || undefined,
      };
      if (dialogState.mode === "grant") {
        return grantSmsCredits(tenantId, data);
      }
      return revokeSmsCredits(tenantId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sms-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sms-credits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-transactions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant", tenantId] });
      closeDialog();
    },
  });

  function openDialog(mode: "grant" | "revoke") {
    setDialogState({ open: true, mode });
    setAmount("");
    setDescription("");
  }

  function closeDialog() {
    setDialogState({ open: false, mode: "grant" });
    setAmount("");
    setDescription("");
  }

  const TX_TYPE_LABELS: Record<string, string> = {
    grant: "Attribution",
    spend: "Envoi SMS",
    revoke: "Révocation",
  };

  return (
    <div className="space-y-6">
      {/* OVH Platform Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Crédits OVH (plateforme)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ovhLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : ovhCredits && !("error" in ovhCredits) ? (
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-3xl font-bold">{ovhCredits.creditsLeft}</span>
                <span className="ml-2 text-muted-foreground">crédits OVH</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{totalDistributed}</span> distribués &middot;{" "}
                <span className="font-medium text-foreground">{available ?? "?"}</span> disponibles
              </div>
              <a href={ovhCredits.buyUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Acheter des crédits
                </Button>
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground">OVH SMS non configuré.</p>
          )}
        </CardContent>
      </Card>

      {/* Tenant Credit Balance + Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Crédits de {tenantName}</CardTitle>
              <CardDescription>Solde actuel et actions</CardDescription>
            </div>
            <div className="text-3xl font-bold font-mono">{thisTenant?.smsCredits ?? 0}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openDialog("grant")} disabled={grantDisabled}>
              <Plus className="mr-1 h-3 w-3" />
              Attribuer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog("revoke")}
              disabled={!thisTenant || thisTenant.smsCredits === 0}
            >
              <Minus className="mr-1 h-3 w-3" />
              Révoquer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !transactionsData?.data?.length ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune transaction
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsData.data.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.type === "revoke" || tx.type === "spend" ? "-" : "+"}
                      {tx.amount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Grant / Revoke Dialog */}
      <Dialog open={dialogState.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "grant" ? "Attribuer des crédits" : "Révoquer des crédits"}
            </DialogTitle>
            <DialogDescription>
              {dialogState.mode === "grant"
                ? `Ajoutez des crédits SMS à ${tenantName}. ${maxGrant !== undefined ? `${maxGrant} crédit(s) disponible(s).` : ""}`
                : `Retirez des crédits SMS de ${tenantName} (solde : ${thisTenant?.smsCredits ?? 0})`}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="amount">Nombre de crédits</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max={dialogState.mode === "revoke" ? thisTenant?.smsCredits : maxGrant}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Raison..."
                rows={2}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  !amount ||
                  Number(amount) < 1 ||
                  (dialogState.mode === "grant" && maxGrant !== undefined && Number(amount) > maxGrant) ||
                  mutation.isPending
                }
              >
                {mutation.isPending ? "En cours..." : dialogState.mode === "grant" ? "Attribuer" : "Révoquer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ OWNERS TAB ============

function CreateOwnerDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createOwnerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      createTenantOwner(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-owners", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant", tenantId] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); mutation.reset(); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un propriétaire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouveau propriétaire</DialogTitle>
          <DialogDescription>
            Créez un compte propriétaire pour ce tenant.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jean@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormDescription>8 caractères minimum</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur lors de la création"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function OwnersTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenant-owners", tenantId],
    queryFn: () => fetchTenantOwners(tenantId),
  });

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => toggleOwnerActive(tenantId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-owners", tenantId] });
    },
  });

  const owners = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Propriétaires</CardTitle>
            <CardDescription>Comptes propriétaires de ce tenant</CardDescription>
          </div>
          <CreateOwnerDialog tenantId={tenantId} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : owners.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Aucun propriétaire
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((owner) => (
                <TableRow key={owner.id}>
                  <TableCell className="font-medium">{owner.name || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{owner.email}</TableCell>
                  <TableCell>
                    <Badge variant={owner.isActive ? "active" : "inactive"}>
                      {owner.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(owner.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Êtes-vous sûr de vouloir ${owner.isActive ? "désactiver" : "réactiver"} ce propriétaire ?`)) {
                          toggleMutation.mutate(owner.id);
                        }
                      }}
                      disabled={toggleMutation.isPending}
                    >
                      {owner.isActive ? "Désactiver" : "Réactiver"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MAIN PAGE ============

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tenant", tenantId],
    queryFn: () => fetchTenant(tenantId),
  });

  const tenant = data?.data;

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Tenant non trouvé</p>
        <Link href="/admin">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Tenants
        </Link>
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <Badge variant="outline" className="font-mono text-xs">
            {tenant.slug}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="owners" className="gap-2">
            <Users className="h-4 w-4" />
            Propriétaires
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <InformationsTab tenant={tenant} />
        </TabsContent>
        <TabsContent value="sms" className="mt-4">
          <SmsTab tenantId={tenantId} tenantName={tenant.name} />
        </TabsContent>
        <TabsContent value="owners" className="mt-4">
          <OwnersTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/client/app/\(admin\)/admin/\(authenticated\)/tenants/\[tenantId\]/page.tsx
git commit -m "feat: add tenant detail page with info, SMS, and owners tabs"
```

---

## Chunk 5: Frontend — Admin Users Page + Cleanup

### Task 11: Create platform admin management page

**Files:**
- Create: `apps/client/app/(admin)/admin/(authenticated)/users/page.tsx`

- [ ] **Step 1: Create the admin users page**

Create `apps/client/app/(admin)/admin/(authenticated)/users/page.tsx`:

```typescript
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createAdminSchema, updateAdminSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AdminUser,
  createAdminUser,
  fetchAdminUsers,
  formatDate,
  toggleAdminActive,
  updateAdminUser,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ============ CREATE ADMIN DIALOG ============

function CreateAdminDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); mutation.reset(); } }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouvel administrateur</DialogTitle>
          <DialogDescription>
            Créez un nouveau compte administrateur plateforme.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jean@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormDescription>8 caractères minimum</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur lors de la création"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ EDIT ADMIN DIALOG ============

function EditAdminDialog({
  admin,
  open,
  onOpenChange,
}: {
  admin: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(updateAdminSchema),
    defaultValues: {
      name: admin.name || "",
      email: admin.email,
    },
  });

  useEffect(() => {
    form.reset({
      name: admin.name || "",
      email: admin.email,
    });
  }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      updateAdminUser(admin.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onOpenChange(false);
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier l'administrateur</DialogTitle>
          <DialogDescription>
            Modifiez les informations de {admin.name || admin.email}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jean@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN PAGE ============

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAdminActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const admins = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administrateurs</h1>
          <p className="text-muted-foreground">
            Gestion des comptes administrateurs de la plateforme
          </p>
        </div>
        <CreateAdminDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comptes administrateurs</CardTitle>
          <CardDescription>
            Les administrateurs ont accès à toutes les fonctionnalités de la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-muted-foreground">
              Erreur lors du chargement des administrateurs
            </div>
          ) : admins.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun administrateur trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const isSelf = currentUser?.id === admin.id;
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          {admin.name || "-"}
                          {isSelf && (
                            <Badge variant="outline" className="text-xs">
                              vous
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.isActive ? "active" : "inactive"}>
                          {admin.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(admin.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingAdmin(admin)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Êtes-vous sûr de vouloir ${admin.isActive ? "désactiver" : "réactiver"} cet administrateur ?`)) {
                                toggleMutation.mutate(admin.id);
                              }
                            }}
                            disabled={isSelf || toggleMutation.isPending}
                            title={isSelf ? "Vous ne pouvez pas vous désactiver vous-même" : undefined}
                          >
                            {admin.isActive ? "Désactiver" : "Réactiver"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingAdmin && (
        <EditAdminDialog
          admin={editingAdmin}
          open={!!editingAdmin}
          onOpenChange={(open) => !open && setEditingAdmin(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/client/app/\(admin\)/admin/\(authenticated\)/users/page.tsx
git commit -m "feat: add platform admin management page"
```

---

### Task 12: Delete old SMS page

**Files:**
- Delete: `apps/client/app/(admin)/admin/(authenticated)/sms/page.tsx`

- [ ] **Step 1: Remove the old SMS page**

Run: `rm apps/client/app/\(admin\)/admin/\(authenticated\)/sms/page.tsx`

Then check if the sms directory is empty and remove it:
Run: `rmdir apps/client/app/\(admin\)/admin/\(authenticated\)/sms/ 2>/dev/null || true`

- [ ] **Step 2: Commit**

```bash
git add -A apps/client/app/\(admin\)/admin/\(authenticated\)/sms/
git commit -m "feat: remove old admin SMS page (moved to tenant detail)"
```

---

### Task 13: Verify full build

- [ ] **Step 1: Build the entire project**

Run: `pnpm build`
Expected: All packages build successfully.

- [ ] **Step 2: Fix any build errors**

If there are build errors, fix them and commit fixes.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build errors from admin dashboard restructure"
```
