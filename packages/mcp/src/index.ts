import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ── Config ──────────────────────────────────────────────────────
const API_URL = process.env.PREPAREOS_API_URL || "http://localhost:3002";
const API_TOKEN = process.env.PREPAREOS_TOKEN || "";

// ── HTTP helper ─────────────────────────────────────────────────
async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_TOKEN) headers["Authorization"] = `Bearer ${API_TOKEN}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ── MCP Server ──────────────────────────────────────────────────
const server = new McpServer({
  name: "prepareos",
  version: "0.1.0",
});

// ═══════════════════════════════════════════════════════════════
// ORDERS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_orders",
  "List orders with optional filters (status, date range, pagination)",
  {
    status: z.string().optional().describe("Filter by status: pending, preparing, ready, completed, cancelled"),
    page: z.number().optional().describe("Page number (default 1)"),
    limit: z.number().optional().describe("Items per page (default 20)"),
    startDate: z.string().optional().describe("Filter orders after this date (ISO)"),
    endDate: z.string().optional().describe("Filter orders before this date (ISO)"),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.startDate) qs.set("startDate", params.startDate);
    if (params.endDate) qs.set("endDate", params.endDate);
    const data = await api(`/api/orders?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_order",
  "Get a single order by ID with all items",
  { orderId: z.string().describe("Order ID") },
  async ({ orderId }) => {
    const data = await api(`/api/orders/${orderId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_order",
  "Create a new order",
  {
    clientId: z.string().optional().describe("Client ID (optional)"),
    clientName: z.string().optional().describe("Client name for walk-in orders"),
    clientPhone: z.string().optional().describe("Client phone"),
    pickupDate: z.string().describe("Pickup date/time (ISO)"),
    notes: z.string().optional().describe("Order notes"),
    items: z.array(z.object({
      productId: z.string().describe("Product ID"),
      quantity: z.number().describe("Quantity"),
      notes: z.string().optional().describe("Item-specific notes"),
    })).describe("Order items"),
  },
  async (params) => {
    const data = await api("/api/orders", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_order_status",
  "Update an order's status",
  {
    orderId: z.string().describe("Order ID"),
    status: z.string().describe("New status: pending, preparing, ready, completed, cancelled"),
  },
  async ({ orderId, status }) => {
    const data = await api(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      body: { status },
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "toggle_item_prepared",
  "Mark an order item as prepared or not",
  {
    orderId: z.string().describe("Order ID"),
    itemId: z.string().describe("Order item ID"),
    isPrepared: z.boolean().describe("Whether the item is prepared"),
  },
  async ({ orderId, itemId, isPrepared }) => {
    const data = await api(`/api/orders/${orderId}/items/${itemId}/prepared`, {
      method: "PATCH",
      body: { isPrepared },
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "delete_order",
  "Delete an order",
  { orderId: z.string().describe("Order ID") },
  async ({ orderId }) => {
    await api(`/api/orders/${orderId}`, { method: "DELETE" });
    return { content: [{ type: "text" as const, text: "Order deleted successfully" }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_products",
  "List all products with optional filters",
  {
    categoryId: z.string().optional().describe("Filter by category ID"),
    search: z.string().optional().describe("Search by name"),
    isAvailable: z.boolean().optional().describe("Filter by availability"),
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.categoryId) qs.set("categoryId", params.categoryId);
    if (params.search) qs.set("search", params.search);
    if (params.isAvailable !== undefined) qs.set("isAvailable", String(params.isAvailable));
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const data = await api(`/api/products?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_product",
  "Get a single product by ID",
  { productId: z.string().describe("Product ID") },
  async ({ productId }) => {
    const data = await api(`/api/products/${productId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_product",
  "Create a new product",
  {
    name: z.string().describe("Product name"),
    description: z.string().optional().describe("Product description"),
    price: z.number().describe("Price in cents"),
    unit: z.string().optional().describe("Unit (e.g. 'kg', 'piece')"),
    categoryId: z.string().optional().describe("Category ID"),
    isAvailable: z.boolean().optional().describe("Whether product is available (default true)"),
  },
  async (params) => {
    const data = await api("/api/products", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_product",
  "Update a product",
  {
    productId: z.string().describe("Product ID"),
    name: z.string().optional(),
    description: z.string().optional(),
    price: z.number().optional(),
    unit: z.string().optional(),
    categoryId: z.string().optional(),
    isAvailable: z.boolean().optional(),
  },
  async ({ productId, ...body }) => {
    const data = await api(`/api/products/${productId}`, { method: "PATCH", body });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "delete_product",
  "Delete a product",
  { productId: z.string().describe("Product ID") },
  async ({ productId }) => {
    await api(`/api/products/${productId}`, { method: "DELETE" });
    return { content: [{ type: "text" as const, text: "Product deleted successfully" }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_categories",
  "List all product categories",
  {
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const data = await api(`/api/categories?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_category_tree",
  "Get the full category tree with nesting",
  {},
  async () => {
    const data = await api("/api/categories/tree");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_category",
  "Create a new product category",
  {
    name: z.string().describe("Category name"),
    parentId: z.string().optional().describe("Parent category ID for nesting"),
    sortOrder: z.number().optional().describe("Sort order"),
  },
  async (params) => {
    const data = await api("/api/categories", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "delete_category",
  "Delete a category (products get detached, not deleted)",
  { categoryId: z.string().describe("Category ID") },
  async ({ categoryId }) => {
    const data = await api(`/api/categories/${categoryId}`, { method: "DELETE" });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_clients",
  "List all clients with optional filters",
  {
    search: z.string().optional().describe("Search by name or phone"),
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const data = await api(`/api/clients?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_client",
  "Get a single client by ID",
  { clientId: z.string().describe("Client ID") },
  async ({ clientId }) => {
    const data = await api(`/api/clients/${clientId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_client",
  "Create a new client",
  {
    name: z.string().describe("Client name"),
    phone: z.string().optional().describe("Phone number"),
    email: z.string().optional().describe("Email"),
    notes: z.string().optional().describe("Notes about the client"),
  },
  async (params) => {
    const data = await api("/api/clients", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_client",
  "Update a client",
  {
    clientId: z.string().describe("Client ID"),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({ clientId, ...body }) => {
    const data = await api(`/api/clients/${clientId}`, { method: "PATCH", body });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "delete_client",
  "Delete a client",
  { clientId: z.string().describe("Client ID") },
  async ({ clientId }) => {
    await api(`/api/clients/${clientId}`, { method: "DELETE" });
    return { content: [{ type: "text" as const, text: "Client deleted successfully" }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// MENUS (preset menu combos)
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_menus",
  "List all menus (preset combos)",
  {
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const data = await api(`/api/menus?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "get_menu",
  "Get a menu by ID",
  { menuId: z.string().describe("Menu ID") },
  async ({ menuId }) => {
    const data = await api(`/api/menus/${menuId}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_menu",
  "Create a new menu",
  {
    name: z.string().describe("Menu name"),
    description: z.string().optional(),
    price: z.number().describe("Menu price in cents"),
    isAvailable: z.boolean().optional(),
  },
  async (params) => {
    const data = await api("/api/menus", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "delete_menu",
  "Delete a menu",
  { menuId: z.string().describe("Menu ID") },
  async ({ menuId }) => {
    await api(`/api/menus/${menuId}`, { method: "DELETE" });
    return { content: [{ type: "text" as const, text: "Menu deleted successfully" }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// STAFF / USERS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "list_staff",
  "List staff members",
  {
    role: z.string().optional().describe("Filter by role: owner, admin, staff"),
    isActive: z.boolean().optional().describe("Filter by active status"),
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.role) qs.set("role", params.role);
    if (params.isActive !== undefined) qs.set("isActive", String(params.isActive));
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const data = await api(`/api/users/staff?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "create_staff",
  "Create a new staff member with PIN",
  {
    name: z.string().describe("Staff name"),
    email: z.string().describe("Staff email"),
    pin: z.string().describe("4-digit PIN for quick login"),
    role: z.string().optional().describe("Role: staff, admin, owner"),
  },
  async (params) => {
    const data = await api("/api/users/staff", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_staff",
  "Update a staff member",
  {
    userId: z.string().describe("User ID"),
    name: z.string().optional(),
    pin: z.string().optional(),
    role: z.string().optional(),
    isActive: z.boolean().optional(),
  },
  async ({ userId, ...body }) => {
    const data = await api(`/api/users/${userId}`, { method: "PATCH", body });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// SMS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "get_sms_credits",
  "Check SMS credit balance",
  {},
  async () => {
    const data = await api("/api/sms/credits");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "send_sms",
  "Send an SMS to a phone number (costs 1 credit)",
  {
    recipientPhone: z.string().describe("Phone number in international format"),
    content: z.string().describe("SMS message content"),
    recipientName: z.string().optional().describe("Recipient name for logging"),
  },
  async (params) => {
    const data = await api("/api/sms/send", { method: "POST", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "list_sms_messages",
  "List sent SMS messages",
  {
    page: z.number().optional(),
    limit: z.number().optional(),
  },
  async (params) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.limit) qs.set("limit", String(params.limit));
    const data = await api(`/api/sms/messages?${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// TENANT SETTINGS
// ═══════════════════════════════════════════════════════════════

server.tool(
  "get_tenant_info",
  "Get current tenant info (name, settings, etc.)",
  {},
  async () => {
    const data = await api("/api/tenants");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  "update_tenant_settings",
  "Update tenant settings",
  {
    businessName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    openingHours: z.string().optional().describe("JSON string of opening hours"),
  },
  async (params) => {
    const data = await api("/api/tenants/settings", { method: "PATCH", body: params });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
);

// ═══════════════════════════════════════════════════════════════
// Start
// ═══════════════════════════════════════════════════════════════

const transport = new StdioServerTransport();
await server.connect(transport);
