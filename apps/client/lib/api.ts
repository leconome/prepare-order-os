import type {
  AttributeTerm,
  Category,
  CategoryFilters,
  Client,
  ClientFilters,
  CreateAttribute,
  CreateCategory,
  CreateClient,
  CreateMenu,
  CreateOrder,
  CreateOrderItem,
  CreatePointOfSale,
  CreateProduct,
  CreateStaff,
  CreateTerm,
  CreateVariant,
  GrantCredits,
  Menu,
  MenuFilters,
  MenuWithProducts,
  Order,
  OrderFilters,
  OrderItemWithMenuItems,
  OrderMenuItem,
  OrderWithItems,
  PointOfSale,
  PointOfSaleFilters,
  Product,
  ProductAttributeWithTerms,
  ProductFilters,
  ProductVariant,
  RevokeCredits,
  SendSms,
  SmsCreditFilters,
  SmsCreditTransaction,
  SmsFilters,
  SmsMessage,
  StaffFilters,
  Tenant,
  UpdateAttribute,
  UpdateCategory,
  UpdateClient,
  UpdateMenu,
  UpdateOrder,
  UpdateOrderStatus,
  UpdatePointOfSale,
  UpdateProduct,
  UpdateStaff,
  UpdateTenantSettings,
  UpdateTerm,
  UpdateVariant,
  User,
} from "@prepareos/data";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_API_URL || "http://localhost:9000";

const IS_DEV = process.env.NEXT_PUBLIC_STAGE === "dev";

// ============ DEV TENANT SELECTION ============

const DEV_TENANT_KEY = "dev-tenant-slug";

export function getDevTenant(): string | null {
  if (!IS_DEV || typeof window === "undefined") return null;
  return localStorage.getItem(DEV_TENANT_KEY);
}

export function setDevTenant(slug: string | null) {
  if (typeof window === "undefined") return;
  if (slug) {
    localStorage.setItem(DEV_TENANT_KEY, slug);
  } else {
    localStorage.removeItem(DEV_TENANT_KEY);
  }
}

export type DevTenant = { id: string; name: string; slug: string };

export async function fetchDevTenants(): Promise<{ tenants: DevTenant[] }> {
  const url = `${API_URL}/api/dev/tenants`;
  const res = await fetch(url);
  if (!res.ok) return { tenants: [] };
  return res.json();
}

// ============ FETCH WRAPPER ============

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}/api${endpoint}`;

  const devHeaders: Record<string, string> = {};
  if (IS_DEV) {
    const slug = getDevTenant();
    if (slug) devHeaders["X-Dev-Tenant"] = slug;
  }

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...devHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============ PAGINATION TYPES ============

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============ ORDERS ============

export type OrdersResponse = PaginatedResponse<OrderWithItems>;

export async function fetchOrders(
  params?: Partial<OrderFilters>,
): Promise<OrdersResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.clientId) searchParams.set("clientId", params.clientId);
  if (params?.paymentStatus)
    searchParams.set("paymentStatus", params.paymentStatus);
  if (params?.preparationStatus)
    searchParams.set("preparationStatus", params.preparationStatus);
  if (params?.createdById) searchParams.set("createdById", params.createdById);
  if (params?.assignedToId)
    searchParams.set("assignedToId", params.assignedToId);
  if (params?.pickupDate)
    searchParams.set("pickupDate", params.pickupDate.toISOString());
  if (params?.pickupDateFrom)
    searchParams.set("pickupDateFrom", params.pickupDateFrom.toISOString());
  if (params?.pickupDateTo)
    searchParams.set("pickupDateTo", params.pickupDateTo.toISOString());
  if (params?.fromDate)
    searchParams.set("fromDate", params.fromDate.toISOString());
  if (params?.toDate) searchParams.set("toDate", params.toDate.toISOString());
  if (params?.posId) searchParams.set("posId", params.posId);

  const query = searchParams.toString();
  return fetchApi<OrdersResponse>(`/orders${query ? `?${query}` : ""}`);
}

export async function fetchOrder(orderId: string): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>(`/orders/${orderId}`);
}

export async function createOrder(data: CreateOrder): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateOrder(
  orderId: string,
  data: UpdateOrder,
): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>(`/orders/${orderId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateOrderStatus(
  orderId: string,
  data: UpdateOrderStatus,
): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>(`/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function updateOrderItems(
  orderId: string,
  data: { items: CreateOrderItem[] },
): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>(`/orders/${orderId}/items`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteOrder(orderId: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/orders/${orderId}`, {
    method: "DELETE",
  });
}

export async function toggleOrderItemPrepared(
  orderId: string,
  itemId: string,
  isPrepared: boolean,
): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>(
    `/orders/${orderId}/items/${itemId}/prepared`,
    {
      method: "PATCH",
      body: JSON.stringify({ isPrepared }),
    },
  );
}

export async function toggleMenuItemPrepared(
  orderId: string,
  menuItemId: string,
  isPrepared: boolean,
): Promise<OrderWithItems> {
  return fetchApi<OrderWithItems>(
    `/orders/${orderId}/menu-items/${menuItemId}/prepared`,
    {
      method: "PATCH",
      body: JSON.stringify({ isPrepared }),
    },
  );
}

// ============ PRODUCTS ============

export type ProductsResponse = PaginatedResponse<Product>;

export async function fetchProducts(
  params?: Partial<ProductFilters>,
): Promise<ProductsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.categoryId) searchParams.set("categoryId", params.categoryId);
  if (params?.isActive !== undefined)
    searchParams.set("isActive", String(params.isActive));
  if (params?.search) searchParams.set("search", params.search);
  if (params?.maxStock !== undefined)
    searchParams.set("maxStock", String(params.maxStock));

  const query = searchParams.toString();
  return fetchApi<ProductsResponse>(`/products${query ? `?${query}` : ""}`);
}

export async function fetchProduct(productId: string): Promise<Product> {
  return fetchApi<Product>(`/products/${productId}`);
}

export async function createProduct(data: CreateProduct): Promise<Product> {
  return fetchApi<Product>("/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProduct(
  productId: string,
  data: UpdateProduct,
): Promise<Product> {
  return fetchApi<Product>(`/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/products/${productId}`, {
    method: "DELETE",
  });
}

export async function uploadProductImage(
  file: File,
): Promise<{ url: string; key: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_URL}/api/uploads/product-image`;
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Upload failed" }));
    throw new Error(error.error || `Upload failed: HTTP ${response.status}`);
  }

  return response.json();
}

// ============ PRODUCT VARIANTS ============

export async function fetchVariants(
  productId: string,
): Promise<ProductVariant[]> {
  return fetchApi<ProductVariant[]>(`/products/${productId}/variants`);
}

export async function createVariant(
  productId: string,
  data: CreateVariant,
): Promise<ProductVariant> {
  return fetchApi<ProductVariant>(`/products/${productId}/variants`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateVariant(
  productId: string,
  variantId: string,
  data: UpdateVariant,
): Promise<ProductVariant> {
  return fetchApi<ProductVariant>(
    `/products/${productId}/variants/${variantId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteVariant(
  productId: string,
  variantId: string,
): Promise<void> {
  await fetchApi<{ success: boolean }>(
    `/products/${productId}/variants/${variantId}`,
    { method: "DELETE" },
  );
}

// ============ CATEGORIES ============

export type CategoriesResponse = PaginatedResponse<Category>;

export async function fetchCategories(
  params?: Partial<CategoryFilters>,
): Promise<CategoriesResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.parentId) searchParams.set("parentId", params.parentId);
  if (params?.isActive !== undefined)
    searchParams.set("isActive", String(params.isActive));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return fetchApi<CategoriesResponse>(`/categories${query ? `?${query}` : ""}`);
}

export async function fetchCategory(categoryId: string): Promise<Category> {
  return fetchApi<Category>(`/categories/${categoryId}`);
}

export async function createCategory(data: CreateCategory): Promise<Category> {
  return fetchApi<Category>("/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCategory(
  categoryId: string,
  data: UpdateCategory,
): Promise<Category> {
  return fetchApi<Category>(`/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchCategoryProductCount(
  categoryId: string,
): Promise<number> {
  const result = await fetchApi<{ count: number }>(
    `/categories/${categoryId}/product-count`,
  );
  return result.count;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/categories/${categoryId}`, {
    method: "DELETE",
  });
}

// ============ ATTRIBUTES ============

export async function fetchAttributes(): Promise<ProductAttributeWithTerms[]> {
  return fetchApi<ProductAttributeWithTerms[]>("/attributes");
}

export async function fetchAttribute(
  id: string,
): Promise<ProductAttributeWithTerms> {
  return fetchApi<ProductAttributeWithTerms>(`/attributes/${id}`);
}

export async function createAttribute(
  data: CreateAttribute,
): Promise<ProductAttributeWithTerms> {
  return fetchApi<ProductAttributeWithTerms>("/attributes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAttribute(
  id: string,
  data: UpdateAttribute,
): Promise<ProductAttributeWithTerms> {
  return fetchApi<ProductAttributeWithTerms>(`/attributes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteAttribute(id: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/attributes/${id}`, {
    method: "DELETE",
  });
}

export async function createAttributeTerm(
  attributeId: string,
  data: CreateTerm,
): Promise<AttributeTerm> {
  return fetchApi<AttributeTerm>(`/attributes/${attributeId}/terms`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAttributeTerm(
  attributeId: string,
  termId: string,
  data: UpdateTerm,
): Promise<AttributeTerm> {
  return fetchApi<AttributeTerm>(
    `/attributes/${attributeId}/terms/${termId}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
  );
}

export async function deleteAttributeTerm(
  attributeId: string,
  termId: string,
): Promise<void> {
  await fetchApi<{ success: boolean }>(
    `/attributes/${attributeId}/terms/${termId}`,
    { method: "DELETE" },
  );
}

// ============ MENUS ============

export type MenusResponse = PaginatedResponse<MenuWithProducts>;

export async function fetchMenus(
  params?: Partial<MenuFilters>,
): Promise<MenusResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.isActive !== undefined)
    searchParams.set("isActive", String(params.isActive));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return fetchApi<MenusResponse>(`/menus${query ? `?${query}` : ""}`);
}

export async function fetchMenu(menuId: string): Promise<MenuWithProducts> {
  return fetchApi<MenuWithProducts>(`/menus/${menuId}`);
}

export async function createMenu(data: CreateMenu): Promise<MenuWithProducts> {
  return fetchApi<MenuWithProducts>("/menus", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMenu(
  menuId: string,
  data: UpdateMenu,
): Promise<MenuWithProducts> {
  return fetchApi<MenuWithProducts>(`/menus/${menuId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteMenu(menuId: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/menus/${menuId}`, {
    method: "DELETE",
  });
}

// ============ STAFF (USERS) ============

export type StaffUser = Pick<
  User,
  "id" | "name" | "email" | "pin" | "role" | "isActive" | "createdAt" | "updatedAt"
>;

export type StaffResponse = PaginatedResponse<StaffUser>;

export async function fetchStaff(
  params?: Partial<StaffFilters>,
): Promise<StaffResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.role) searchParams.set("role", params.role);
  if (params?.isActive !== undefined)
    searchParams.set("isActive", String(params.isActive));

  const query = searchParams.toString();
  return fetchApi<StaffResponse>(`/users/staff${query ? `?${query}` : ""}`);
}

export async function createStaff(data: CreateStaff): Promise<StaffUser> {
  return fetchApi<StaffUser>("/users/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStaff(
  userId: string,
  data: UpdateStaff,
): Promise<StaffUser> {
  return fetchApi<StaffUser>(`/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteStaff(userId: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/users/${userId}`, {
    method: "DELETE",
  });
}

// ============ CLIENTS ============

export type ClientsResponse = PaginatedResponse<Client>;

export async function fetchClients(
  params?: Partial<ClientFilters>,
): Promise<ClientsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return fetchApi<ClientsResponse>(`/clients${query ? `?${query}` : ""}`);
}

export async function fetchClient(clientId: string): Promise<Client> {
  return fetchApi<Client>(`/clients/${clientId}`);
}

export async function createClient(data: CreateClient): Promise<Client> {
  return fetchApi<Client>("/clients", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateClient(
  clientId: string,
  data: UpdateClient,
): Promise<Client> {
  return fetchApi<Client>(`/clients/${clientId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteClient(clientId: string): Promise<void> {
  await fetchApi<{ success: boolean }>(`/clients/${clientId}`, {
    method: "DELETE",
  });
}

// ============ PIN AUTH ============

export type LoginStaffMember = {
  id: string;
  name: string | null;
  image: string | null;
};

export async function fetchLoginStaff(): Promise<{
  staff: LoginStaffMember[];
}> {
  return fetchApi<{ staff: LoginStaffMember[] }>("/users/login-staff");
}

export async function loginWithPin(
  userId: string,
  pin: string,
): Promise<{
  user: { id: string; name: string | null; email: string; role: string };
}> {
  return fetchApi("/users/login-pin", {
    method: "POST",
    body: JSON.stringify({ userId, pin }),
  });
}

// ============ AUTH (DEV) ============

export async function checkUserExists(
  email: string,
): Promise<{
  exists: boolean;
  user: { id: string; email: string; name: string; role: string } | null;
}> {
  return fetchApi(`/users/check/${encodeURIComponent(email)}`);
}

export async function signUpDevUser(data: {
  email: string;
  password: string;
  name: string;
  role: string;
}): Promise<unknown> {
  return fetchApi("/users/dev-signup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============ TENANTS ============

export async function fetchTenantSettings(): Promise<Tenant> {
  return fetchApi<Tenant>("/tenants");
}

export async function updateTenantSettings(
  data: UpdateTenantSettings,
): Promise<Tenant> {
  return fetchApi<Tenant>("/tenants/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function generateApiKey(): Promise<{ apiKey: string }> {
  return fetchApi<{ apiKey: string }>("/tenants/api-key/generate", {
    method: "POST",
  });
}

export async function syncCategoriesToWoo(): Promise<{
  ok: boolean;
  created: number;
  updated: number;
}> {
  return fetchApi("/tenants/sync/categories", {
    method: "POST",
  });
}

export async function syncAttributesToWoo(): Promise<{
  ok: boolean;
  created: number;
  updated: number;
}> {
  return fetchApi("/tenants/sync/attributes", {
    method: "POST",
  });
}

export async function syncProductsToWoo(): Promise<{
  ok: boolean;
  created: number;
  updated: number;
}> {
  return fetchApi("/tenants/sync/products", {
    method: "POST",
  });
}

// ============ ADMIN ============

export async function fetchAllTenants(): Promise<{
  data: Tenant[];
}> {
  return fetchApi<{ data: Tenant[] }>("/admin/tenants");
}

// ============ ADMIN SMS ============

export async function fetchAdminSmsCredits(): Promise<{
  creditsLeft: number;
  name: string;
  buyUrl: string;
}> {
  return fetchApi("/admin/sms/credits");
}

export type SmsTenant = {
  id: string;
  name: string;
  slug: string;
  smsCredits: number;
};

export async function fetchAdminSmsTenants(): Promise<{
  data: SmsTenant[];
  totalDistributed: number;
  available: number | null;
}> {
  return fetchApi("/admin/sms/tenants");
}

export async function grantSmsCredits(
  tenantId: string,
  data: GrantCredits,
): Promise<{ credits: number }> {
  return fetchApi(`/admin/sms/tenants/${tenantId}/grant`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function revokeSmsCredits(
  tenantId: string,
  data: RevokeCredits,
): Promise<{ credits: number }> {
  return fetchApi(`/admin/sms/tenants/${tenantId}/revoke`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchAdminTenantTransactions(
  tenantId: string,
  params?: Partial<SmsCreditFilters>,
): Promise<PaginatedResponse<SmsCreditTransaction>> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set("type", params.type);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  return fetchApi(`/admin/sms/tenants/${tenantId}/transactions${query ? `?${query}` : ""}`);
}

// ============ TENANT SMS ============

export async function fetchSmsCredits(): Promise<{ credits: number }> {
  return fetchApi("/sms/credits");
}

export async function fetchSmsTransactions(
  params?: Partial<SmsCreditFilters>,
): Promise<PaginatedResponse<SmsCreditTransaction>> {
  const searchParams = new URLSearchParams();
  if (params?.type) searchParams.set("type", params.type);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  return fetchApi(`/sms/transactions${query ? `?${query}` : ""}`);
}

export async function fetchSmsMessages(
  params?: Partial<SmsFilters>,
): Promise<PaginatedResponse<SmsMessage>> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.fromDate) searchParams.set("fromDate", params.fromDate.toISOString());
  if (params?.toDate) searchParams.set("toDate", params.toDate.toISOString());
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const query = searchParams.toString();
  return fetchApi(`/sms/messages${query ? `?${query}` : ""}`);
}

export async function sendSms(data: SendSms): Promise<SmsMessage> {
  return fetchApi("/sms/send", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function refreshSmsStatus(messageId: string): Promise<SmsMessage> {
  return fetchApi(`/sms/messages/${messageId}/refresh`, {
    method: "POST",
  });
}

// ============ POINTS OF SALE ============

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

// ============ UTILS ============

export function formatCurrency(
  amount: string | number,
  currencyCode: string = "EUR",
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currencyCode,
  }).format(numAmount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function formatDateWithAgo(date: string | Date): {
  full: string;
  ago: string;
} {
  const d = new Date(date);
  const full = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  let ago: string;
  if (seconds < 60) ago = "à l'instant";
  else if (seconds < 3600)
    ago = `il y a ${Math.floor(seconds / 60)} min`;
  else if (seconds < 86400)
    ago = `il y a ${Math.floor(seconds / 3600)}h`;
  else if (seconds < 2592000)
    ago = `il y a ${Math.floor(seconds / 86400)}j`;
  else ago = `il y a ${Math.floor(seconds / 2592000)} mois`;

  return { full, ago };
}

// Re-export types for convenience
export type {
  Order,
  OrderWithItems,
  OrderItemWithMenuItems,
  OrderMenuItem,
  OrderFilters,
  CreateOrder,
  CreateOrderItem,
  UpdateOrder,
  UpdateOrderStatus,
  Product,
  CreateProduct,
  UpdateProduct,
  ProductFilters,
  Category,
  CreateCategory,
  UpdateCategory,
  CategoryFilters,
  Menu,
  MenuWithProducts,
  CreateMenu,
  UpdateMenu,
  MenuFilters,
  User,
  StaffFilters,
  CreateStaff,
  UpdateStaff,
  Client,
  CreateClient,
  UpdateClient,
  ClientFilters,
  Tenant,
  UpdateTenantSettings,
  SmsCreditTransaction,
  SmsMessage,
  SmsFilters,
  SmsCreditFilters,
  GrantCredits,
  RevokeCredits,
  SendSms,
  PointOfSale,
  CreatePointOfSale,
  UpdatePointOfSale,
  PointOfSaleFilters,
};
