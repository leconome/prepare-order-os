import type {
  Order,
  OrderWithItems,
  OrderFilters,
  CreateOrder,
  UpdateOrder,
  UpdateOrderStatus,
} from "@repo/store-types";

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

export interface OrdersResponse {
  data: OrderWithItems[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface OrderResponse {
  order: OrderWithItems;
}

export async function fetchOrders(
  params?: Partial<OrderFilters>,
): Promise<OrdersResponse> {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
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

// Format currency
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

// Format date
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
  OrderFilters,
  CreateOrder,
  UpdateOrder,
  UpdateOrderStatus,
};
