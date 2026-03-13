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
        stock: z.number().nullable().openapi({ description: "Decimal stock, e.g. 10 or 2.5" }),
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
        "[View ER Diagram](/api/docs/diagram)\n\n" +
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

// Serve ER diagram page
// biome-ignore lint/suspicious/noExplicitAny: Hono loses type inference after chained .get()
docs.get("/diagram", (c: any) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>PrepareOS — ER Diagram</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f0f; color: #e0e0e0; overflow: hidden; }
    header { padding: 16px 24px; border-bottom: 1px solid #2a2a2a; display: flex; align-items: center; gap: 16px; position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: #0f0f0f; }
    header a { color: #8b8bf5; text-decoration: none; font-size: 14px; }
    header a:hover { text-decoration: underline; }
    h1 { font-size: 18px; font-weight: 600; }
    .controls { margin-left: auto; display: flex; gap: 8px; align-items: center; font-size: 13px; color: #888; }
    .controls button { background: #1a1a1a; color: #e0e0e0; border: 1px solid #333; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 14px; }
    .controls button:hover { background: #2a2a2a; }
    .viewport { position: fixed; top: 53px; left: 0; right: 0; bottom: 0; overflow: hidden; cursor: grab; }
    .viewport.grabbing { cursor: grabbing; }
    .diagram-container { transform-origin: 0 0; will-change: transform; }
    .diagram-container svg { display: block; }
    table { border-collapse: collapse; margin: 0 auto 48px; }
    th, td { padding: 8px 16px; text-align: left; border: 1px solid #2a2a2a; }
    th { background: #1a1a1a; font-weight: 600; }
    td { background: #111; }
    h2 { text-align: center; margin: 32px 0 16px; font-size: 16px; font-weight: 600; }
  </style>
</head>
<body>
  <header>
    <h1>PrepareOS — ER Diagram</h1>
    <a href="/api/docs">&larr; Back to API Docs</a>
    <div class="controls">
      <button id="zoom-out" title="Zoom out">-</button>
      <span id="zoom-level">100%</span>
      <button id="zoom-in" title="Zoom in">+</button>
      <button id="zoom-fit" title="Fit to screen">Fit</button>
      <button id="zoom-reset" title="Reset zoom">1:1</button>
    </div>
  </header>

  <div class="viewport" id="viewport">
  <div class="diagram-container" id="diagram-container">
    <pre class="mermaid">
erDiagram
    Tenant ||--o{ User : "has staff"
    Tenant ||--o{ Category : "owns"
    Tenant ||--o{ Product : "owns"
    Tenant ||--o{ Menu : "owns"
    Tenant ||--o{ Client : "has customers"
    Tenant ||--o{ Order : "receives"
    Tenant ||--o{ SmsMessage : "sends"
    Tenant ||--o{ SmsCreditTransaction : "ledger"
    Tenant ||--|| TicketCounter : "daily counter"

    Category ||--o{ Category : "parent-children"
    Category ||--o{ Product : "groups"

    Menu ||--o{ MenuProduct : "contains"
    Product ||--o{ MenuProduct : "included in"

    Client ||--o{ Order : "places"
    User ||--o{ Order : "creates"
    User ||--o{ Order : "prepares"

    Order ||--o{ OrderItem : "has lines"
    OrderItem ||--o{ OrderMenuItem : "menu sub-items"

    User ||--o{ Session : "authenticates"
    User ||--o{ Account : "credentials"
    User ||--o{ SmsMessage : "sends"
    User ||--o{ SmsCreditTransaction : "performs"

    Tenant {
        uuid id PK
        string name
        string slug "unique"
        int preparationFilterDays
        int smsCredits
    }

    User {
        string id PK
        string email "unique"
        enum role "admin, owner, staff"
        string pin "hashed 4-digit"
        bool isActive
        uuid tenantId FK "null for admins"
    }

    Session {
        string id PK
        string userId FK
        datetime expiresAt
        string token "unique"
    }

    Account {
        string id PK
        string userId FK
        string providerId
        string password "hashed"
    }

    Category {
        uuid id PK
        string name
        uuid parentId FK "self-ref"
        string color "hex"
        bool isActive
        int sortOrder
        uuid tenantId FK
    }

    Product {
        uuid id PK
        string name
        decimal price
        uuid categoryId FK
        string imageUrl
        int stock "nullable"
        bool isActive
        uuid tenantId FK
    }

    Menu {
        uuid id PK
        string name
        decimal price "bundle price"
        bool isActive
        uuid tenantId FK
    }

    MenuProduct {
        uuid menuId PK "composite"
        uuid productId PK "composite"
        int quantity
        int sortOrder
    }

    Client {
        uuid id PK
        string name
        string phone
        string email
        uuid tenantId FK
    }

    Order {
        uuid id PK
        string ticketNumber "unique"
        uuid clientId FK
        enum paymentStatus
        enum preparationStatus
        datetime pickupDate
        string createdById FK
        string assignedToId FK
        decimal total
        uuid tenantId FK
    }

    OrderItem {
        uuid id PK
        uuid orderId FK
        uuid productId
        string productName
        int quantity
        decimal unitPrice
        bool isMenu
        bool isPrepared
    }

    OrderMenuItem {
        uuid id PK
        uuid orderItemId FK
        uuid productId
        string productName
        int quantity
        bool isPrepared
    }

    SmsCreditTransaction {
        uuid id PK
        uuid tenantId FK
        int amount
        enum type "grant, spend, revoke"
        string createdById FK
    }

    SmsMessage {
        uuid id PK
        uuid tenantId FK
        string recipientPhone
        string content
        enum status
        string sentById FK
    }

    TicketCounter {
        uuid tenantId PK "composite"
        string date PK "composite"
        int lastNumber
    }
    </pre>
  </div>
  </div>

  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });

    // Wait for mermaid to render
    await mermaid.run();

    const viewport = document.getElementById('viewport');
    const container = document.getElementById('diagram-container');
    const zoomLabel = document.getElementById('zoom-level');

    let scale = 1;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function apply() {
      container.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
      zoomLabel.textContent = Math.round(scale * 100) + '%';
    }

    function fitToScreen() {
      const svg = container.querySelector('svg');
      if (!svg) return;
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const sw = svg.clientWidth || svg.getBoundingClientRect().width / scale;
      const sh = svg.clientHeight || svg.getBoundingClientRect().height / scale;
      scale = Math.min(vw / sw, vh / sh, 2) * 0.95;
      panX = (vw - sw * scale) / 2;
      panY = (vh - sh * scale) / 2;
      apply();
    }

    // Fit on load
    setTimeout(fitToScreen, 300);

    // Wheel zoom
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scale;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.min(Math.max(scale * delta, 0.1), 5);
      panX = mx - (mx - panX) * (scale / oldScale);
      panY = my - (my - panY) * (scale / oldScale);
      apply();
    }, { passive: false });

    // Pan
    viewport.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      viewport.classList.add('grabbing');
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      apply();
    });
    viewport.addEventListener('pointerup', () => {
      isDragging = false;
      viewport.classList.remove('grabbing');
    });

    // Button controls
    document.getElementById('zoom-in').addEventListener('click', () => {
      const cx = viewport.clientWidth / 2;
      const cy = viewport.clientHeight / 2;
      const oldScale = scale;
      scale = Math.min(scale * 1.25, 5);
      panX = cx - (cx - panX) * (scale / oldScale);
      panY = cy - (cy - panY) * (scale / oldScale);
      apply();
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
      const cx = viewport.clientWidth / 2;
      const cy = viewport.clientHeight / 2;
      const oldScale = scale;
      scale = Math.max(scale * 0.8, 0.1);
      panX = cx - (cx - panX) * (scale / oldScale);
      panY = cy - (cy - panY) * (scale / oldScale);
      apply();
    });
    document.getElementById('zoom-fit').addEventListener('click', fitToScreen);
    document.getElementById('zoom-reset').addEventListener('click', () => {
      scale = 1;
      panX = 0;
      panY = 0;
      apply();
    });
  </script>
</body>
</html>`;
  return c.html(html);
});

export default docs;
