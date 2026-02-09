import type {
  Category,
  CategoryFilters,
  Client,
  ClientFilters,
  CreateCategory,
  CreateClient,
  CreateMenu,
  CreateOrder,
  CreateProduct,
  CreateStaff,
  Menu,
  MenuFilters,
  MenuWithProducts,
  Order,
  OrderFilters,
  OrderItemWithMenuItems,
  OrderMenuItem,
  OrderWithItems,
  Product,
  ProductFilters,
  StaffFilters,
  Tenant,
  UpdateCategory,
  UpdateClient,
  UpdateMenu,
  UpdateOrder,
  UpdateOrderStatus,
  UpdateProduct,
  UpdateStaff,
  UpdateTenantSettings,
  User,
} from "@prepareos/data";

const API_URL =
  process.env.NEXT_PUBLIC_STORE_API_URL || "http://localhost:9000";

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_URL}/api${endpoint}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
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
  if (params?.fromDate)
    searchParams.set("fromDate", params.fromDate.toISOString());
  if (params?.toDate) searchParams.set("toDate", params.toDate.toISOString());

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

// ============ MENUS ============

export type MenusResponse = PaginatedResponse<Menu>;

export async function fetchMenus(
  params?: Partial<MenuFilters>,
): Promise<MenusResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.isActive !== undefined)
    searchParams.set("isActive", String(params.isActive));

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

// ============ ADMIN ============

export async function fetchAllTenants(): Promise<{
  data: Tenant[];
}> {
  return fetchApi<{ data: Tenant[] }>("/admin/tenants");
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

// Re-export types for convenience
export type {
  Order,
  OrderWithItems,
  OrderItemWithMenuItems,
  OrderMenuItem,
  OrderFilters,
  CreateOrder,
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
};
