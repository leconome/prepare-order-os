# Multi-Tenant Platform

In this model, the platform owner builds a system that hosts many independent tenants.

Each tenant gets its own Medusa instance, database, and tenant-level admin panel. Tenants do not share data or operational context. From the tenant’s perspective, the platform behaves like a private ecommerce backend dedicated only to that tenant.

The platform owner uses a separate super admin panel to oversee all tenants from above. From the platform owner’s perspective, it is a classical multi-tenant architecture with strong isolation between tenants.

## What Medusa provides OOTB
- Individual Medusa instances per tenant.
- Standard ecommerce features per instance.


## What you need to build
To run many isolated Medusa instances under one platform, the following components must be implemented:

- A platform layer that manages multiple Medusa instances.
- Tenant isolation and data separation.
- Super admin dashboard to oversee all tenants.
- Tenant onboarding and provisioning (Essentially view ressources per tenant, DB (postgres), Backend, status & everything, and ability to create, take down instances)
- Billing system per tenant (optional - don't do this now)
- Cross-tenant analytics and reporting.

## When this model fits
This model fits when tenants must run as independent businesses with strict separation. The platform owner can track high-level metrics in a super-admin view without exposing any tenant’s internal data, while each tenant controls its own catalog, pricing, staff, and workflows. It allows tenant-specific integrations like payment providers, and matches a platform model where tenants are billed separately for their own environment.


### Techincalities & very vague intuition

We'd like to host our platform on a VPS on OVH. What I'm seeing is, we could need a internal provisioning API to read statuses, informations, deploy ressources.

You should find a nextjs (admin app), a hono api & a medusa store backend + tenant admin (store)