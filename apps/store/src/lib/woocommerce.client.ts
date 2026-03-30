/**
 * Thin HTTP wrapper for WooCommerce REST API v3.
 * Handles Basic Auth, JSON parsing, and error extraction.
 */

interface WcClientConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

interface WcError {
  code: string;
  message: string;
  data?: { status: number };
}

export class WooCommerceClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: WcClientConfig) {
    this.baseUrl = `${config.storeUrl}/wp-json/wc/v3`;
    this.authHeader = `Basic ${Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64")}`;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = (await res.json().catch(() => ({
        message: `HTTP ${res.status}`,
      }))) as WcError;
      throw new Error(
        `WooCommerce API error (${res.status}): ${error.message || error.code || "Unknown error"}`,
      );
    }

    if (res.status === 204 || res.headers.get("content-length") === "0") {
      return {} as T;
    }

    return res.json() as Promise<T>;
  }

  // System
  async getSystemStatus(): Promise<{
    environment: { version: string };
    settings: { store_name?: string };
  }> {
    return this.request("GET", "/system_status");
  }

  // Products
  async createProduct(data: Record<string, unknown>): Promise<{ id: number }> {
    return this.request("POST", "/products", data);
  }

  async updateProduct(
    id: number,
    data: Record<string, unknown>,
  ): Promise<{ id: number }> {
    return this.request("PUT", `/products/${id}`, data);
  }

  async deleteProduct(id: number): Promise<void> {
    await this.request("DELETE", `/products/${id}?force=true`);
  }

  async batchProducts(payload: {
    create?: Record<string, unknown>[];
    update?: Record<string, unknown>[];
  }): Promise<{
    create?: { id: number }[];
    update?: { id: number }[];
  }> {
    return this.request("POST", "/products/batch", payload);
  }

  // Categories
  async createCategory(
    data: Record<string, unknown>,
  ): Promise<{ id: number }> {
    return this.request("POST", "/products/categories", data);
  }

  async updateCategory(
    id: number,
    data: Record<string, unknown>,
  ): Promise<{ id: number }> {
    return this.request("PUT", `/products/categories/${id}`, data);
  }

  async deleteCategory(id: number): Promise<void> {
    await this.request("DELETE", `/products/categories/${id}?force=true`);
  }

  async batchCategories(payload: {
    create?: Record<string, unknown>[];
    update?: Record<string, unknown>[];
  }): Promise<{
    create?: { id: number }[];
    update?: { id: number }[];
  }> {
    return this.request("POST", "/products/categories/batch", payload);
  }

  // Variations
  async createVariation(
    productId: number,
    data: Record<string, unknown>,
  ): Promise<{ id: number }> {
    return this.request(
      "POST",
      `/products/${productId}/variations`,
      data,
    );
  }

  async updateVariation(
    productId: number,
    id: number,
    data: Record<string, unknown>,
  ): Promise<{ id: number }> {
    return this.request(
      "PUT",
      `/products/${productId}/variations/${id}`,
      data,
    );
  }

  async deleteVariation(productId: number, id: number): Promise<void> {
    await this.request(
      "DELETE",
      `/products/${productId}/variations/${id}?force=true`,
    );
  }

  async batchVariations(
    productId: number,
    payload: {
      create?: Record<string, unknown>[];
      update?: Record<string, unknown>[];
    },
  ): Promise<{
    create?: { id: number }[];
    update?: { id: number }[];
  }> {
    return this.request(
      "POST",
      `/products/${productId}/variations/batch`,
      payload,
    );
  }

  // Stock
  async updateStock(
    productId: number,
    stockQuantity: number | null,
    manageStock: boolean,
  ): Promise<void> {
    await this.request("PUT", `/products/${productId}`, {
      manage_stock: manageStock,
      stock_quantity: stockQuantity,
    });
  }

  async updateVariationStock(
    productId: number,
    variationId: number,
    stockQuantity: number | null,
    manageStock: boolean,
  ): Promise<void> {
    await this.request(
      "PUT",
      `/products/${productId}/variations/${variationId}`,
      {
        manage_stock: manageStock,
        stock_quantity: stockQuantity,
      },
    );
  }

  // Webhooks
  async createWebhook(
    topic: string,
    deliveryUrl: string,
    secret: string,
  ): Promise<{ id: number }> {
    return this.request("POST", "/webhooks", {
      topic,
      delivery_url: deliveryUrl,
      secret,
      status: "active",
    });
  }

  async listWebhooks(): Promise<
    { id: number; topic: string; delivery_url: string; status: string }[]
  > {
    return this.request("GET", "/webhooks?per_page=100");
  }

  async deleteWebhook(id: number): Promise<void> {
    await this.request("DELETE", `/webhooks/${id}?force=true`);
  }
}
