import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { Hono } from "hono";
import { z } from "zod";
import {
  paymentStatusSchema,
  preparationStatusSchema,
  userRoleSchema,
  smsMessageStatusSchema,
  smsCreditTransactionTypeSchema,
} from "@prepareos/data";

extendZodWithOpenApi(z);

const docs = new Hono();

function buildSpec() {
  const registry = new OpenAPIRegistry();

  // ── Tenant ──
  registry.register(
    "Tenant",
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        slug: z.string(),
        preparationFilterDays: z.number().int(),
        smsCredits: z.number().int(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "A tenant (store/business) on the platform" }),
  );

  // ── User ──
  registry.register(
    "User",
    z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string().email(),
        emailVerified: z.boolean(),
        image: z.string().nullable(),
        role: userRoleSchema,
        pin: z.string().nullable().openapi({ description: "Hashed 4-digit PIN for staff login" }),
        isActive: z.boolean(),
        tenantId: z.string().uuid().nullable().openapi({ description: "null for platform admins" }),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "A platform user (admin, owner, or staff)" }),
  );

  // ── Session ──
  registry.register(
    "Session",
    z
      .object({
        id: z.string(),
        userId: z.string(),
        expiresAt: z.string().datetime(),
        token: z.string(),
        ipAddress: z.string().nullable(),
        userAgent: z.string().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "Auth session (Better Auth)" }),
  );

  // ── Category ──
  registry.register(
    "Category",
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string().nullable(),
        parentId: z.string().uuid().nullable().openapi({ description: "Self-referencing parent for tree structure" }),
        imageUrl: z.string().nullable(),
        color: z.string().nullable().openapi({ description: "Hex color e.g. #FF5733" }),
        isActive: z.boolean(),
        sortOrder: z.number().int(),
        tenantId: z.string().uuid(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "Product category with tree support (parentId)" }),
  );

  // ── Product ──
  registry.register(
    "Product",
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string().nullable(),
        price: z.string().openapi({ description: "Decimal string, e.g. 19.99" }),
        categoryId: z.string().uuid().nullable(),
        imageUrl: z.string().nullable(),
        stock: z.number().int().nullable(),
        isActive: z.boolean(),
        sortOrder: z.number().int(),
        tenantId: z.string().uuid(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "A sellable product" }),
  );

  // ── Menu ──
  registry.register(
    "Menu",
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string().nullable(),
        price: z.string().nullable().openapi({ description: "Bundle price (decimal string)" }),
        isActive: z.boolean(),
        sortOrder: z.number().int(),
        tenantId: z.string().uuid(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "Menu bundle grouping multiple products" }),
  );

  // ── MenuProduct (join table) ──
  registry.register(
    "MenuProduct",
    z
      .object({
        menuId: z.string().uuid(),
        productId: z.string().uuid(),
        quantity: z.number().int(),
        sortOrder: z.number().int(),
      })
      .openapi({ description: "Join table: Menu ↔ Product (composite PK)" }),
  );

  // ── Client ──
  registry.register(
    "Client",
    z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        notes: z.string().nullable(),
        tenantId: z.string().uuid(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "A customer of a tenant" }),
  );

  // ── Order ──
  registry.register(
    "Order",
    z
      .object({
        id: z.string().uuid(),
        ticketNumber: z.string().openapi({ description: "Unique ticket e.g. 20260224-001" }),
        clientId: z.string().uuid().nullable(),
        paymentStatus: paymentStatusSchema,
        preparationStatus: preparationStatusSchema,
        pickupDate: z.string().datetime().nullable(),
        pickupTimeStart: z.string().nullable().openapi({ description: "HH:MM" }),
        pickupTimeEnd: z.string().nullable().openapi({ description: "HH:MM" }),
        clientNote: z.string().nullable(),
        internalNote: z.string().nullable(),
        createdById: z.string().nullable(),
        assignedToId: z.string().nullable(),
        subtotal: z.string().openapi({ description: "Decimal string" }),
        taxTotal: z.string().openapi({ description: "Decimal string" }),
        total: z.string().openapi({ description: "Decimal string" }),
        tenantId: z.string().uuid(),
        smsNotifiedAt: z.string().datetime().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "A customer order" }),
  );

  // ── OrderItem ──
  registry.register(
    "OrderItem",
    z
      .object({
        id: z.string().uuid(),
        orderId: z.string().uuid(),
        productId: z.string().uuid(),
        productName: z.string(),
        quantity: z.number().int(),
        unitPrice: z.string(),
        totalPrice: z.string(),
        isMenu: z.boolean().openapi({ description: "True if this line is a menu bundle" }),
        isPrepared: z.boolean(),
        notes: z.string().nullable(),
        createdAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "A line item in an order" }),
  );

  // ── OrderMenuItem ──
  registry.register(
    "OrderMenuItem",
    z
      .object({
        id: z.string().uuid(),
        orderItemId: z.string().uuid(),
        productId: z.string().uuid(),
        productName: z.string(),
        quantity: z.number().int(),
        isPrepared: z.boolean(),
      })
      .openapi({ description: "Sub-item inside a menu order item" }),
  );

  // ── SmsCreditTransaction ──
  registry.register(
    "SmsCreditTransaction",
    z
      .object({
        id: z.string().uuid(),
        tenantId: z.string().uuid(),
        amount: z.number().int(),
        type: smsCreditTransactionTypeSchema,
        description: z.string().nullable(),
        createdById: z.string().nullable(),
        createdAt: z.string().datetime(),
      })
      .openapi({ description: "SMS credit ledger entry (grant / spend / revoke)" }),
  );

  // ── SmsMessage ──
  registry.register(
    "SmsMessage",
    z
      .object({
        id: z.string().uuid(),
        tenantId: z.string().uuid(),
        recipientPhone: z.string(),
        recipientName: z.string().nullable(),
        content: z.string(),
        status: smsMessageStatusSchema,
        ovhMessageId: z.string().nullable(),
        creditsCost: z.number().int(),
        sentById: z.string().nullable(),
        sentAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
      })
      .openapi({ description: "An SMS message sent via OVH" }),
  );

  // ── TicketCounter ──
  registry.register(
    "TicketCounter",
    z
      .object({
        tenantId: z.string().uuid(),
        date: z.string().openapi({ description: "Date string YYYY-MM-DD" }),
        lastNumber: z.number().int(),
      })
      .openapi({ description: "Daily ticket number counter per tenant (composite PK: tenantId + date)" }),
  );

  // Generate the spec — schemas-only, no paths needed
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: "3.0.3",
    info: {
      title: "PrepareOS — Data Model",
      version: "1.0.0",
      description:
        "Entity schemas for the PrepareOS multi-tenant POS platform.\n\n" +
        "**Relationships:**\n" +
        "- Tenant → Users, Categories, Products, Menus, Clients, Orders, SMS\n" +
        "- Category → self (parentId), Products\n" +
        "- Menu ↔ Product (via MenuProduct join)\n" +
        "- Order → Client, OrderItems → OrderMenuItems\n" +
        "- Order → User (createdBy, assignedTo)\n",
    },
  });
}

// Cache the spec
let cachedSpec: ReturnType<typeof buildSpec> | null = null;
function getSpec() {
  if (!cachedSpec) cachedSpec = buildSpec();
  return cachedSpec;
}

// Serve OpenAPI JSON
docs.get("/openapi.json", (c) => c.json(getSpec()));

// Serve Scalar UI
docs.get("/", (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PrepareOS — Data Model</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/api/docs/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
  return c.html(html);
});

export default docs;
