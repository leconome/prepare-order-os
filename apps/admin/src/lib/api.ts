const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN || "localhost";
const IS_PRODUCTION = DOMAIN !== "localhost";

// Helper to get tenant URL
export function getTenantUrl(subdomain: string): string {
  const protocol = IS_PRODUCTION ? "https" : "http";
  return `${protocol}://${subdomain}.${DOMAIN}`;
}

// Helper to get tenant admin URL
export function getTenantAdminUrl(subdomain: string): string {
  return `${getTenantUrl(subdomain)}/app`;
}

export { DOMAIN };

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  status: "pending" | "provisioning" | "running" | "stopped" | "failed" | "terminating" | "terminated";
  config: {
    medusaPort?: number;
    adminPort?: number;
    postgresPort?: number;
    redisPort?: number;
    storeCors?: string;
    adminCors?: string;
  };
  adminEmail?: string;
  medusaVersion?: string | null;
  imageTag?: string | null;
  lastUpgradedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformImage {
  id: string;
  version: string;
  imageTag: string;
  commitSha?: string | null;
  releaseNotes?: string | null;
  isLatest: boolean;
  isDeprecated: boolean;
  createdAt: string;
}

export interface TenantWithResources extends Tenant {
  resources: Array<{
    resourceType: string;
    containerId: string | null;
    containerName: string | null;
    status: string;
    port: number | null;
  }>;
}

export interface TenantHealth {
  status: string;
  containers: Record<string, { status: string; stats?: { cpu: number; memory: number } }>;
}

export interface TenantEvent {
  eventType: string;
  message: string | null;
  createdAt: string;
}

export interface Backup {
  filename: string;
  tenantSlug: string;
  createdAt: string;
  size: number;
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  subdomain: string;
  adminEmail?: string;
  adminPassword?: string;
  config?: {
    storeCors?: string;
    adminCors?: string;
  };
  version?: string;
}

class ApiClient {
  public readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || "Request failed");
    }

    return res.json();
  }

  // Tenants
  async listTenants(): Promise<{ tenants: Tenant[] }> {
    return this.request("/tenants");
  }

  async getTenant(id: string): Promise<{ tenant: TenantWithResources }> {
    return this.request(`/tenants/${id}`);
  }

  async createTenant(input: CreateTenantInput): Promise<{ tenant: Tenant }> {
    return this.request("/tenants", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateTenant(id: string, updates: Partial<Pick<Tenant, "name" | "adminEmail" | "config">>): Promise<{ tenant: Tenant }> {
    return this.request(`/tenants/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTenant(id: string): Promise<{ success: boolean }> {
    return this.request(`/tenants/${id}`, {
      method: "DELETE",
    });
  }

  async provisionTenant(id: string, version?: string): Promise<{ tenant: Tenant }> {
    return this.request(`/tenants/${id}/provision`, {
      method: "POST",
      body: JSON.stringify(version ? { version } : {}),
    });
  }

  async startTenant(id: string): Promise<{ tenant: Tenant }> {
    return this.request(`/tenants/${id}/start`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async stopTenant(id: string): Promise<{ tenant: Tenant }> {
    return this.request(`/tenants/${id}/stop`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async restartTenant(id: string): Promise<{ tenant: Tenant }> {
    return this.request(`/tenants/${id}/restart`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async getTenantLogs(id: string, service: string = "medusa", tail: number = 100): Promise<{ logs: string }> {
    return this.request(`/tenants/${id}/logs?service=${service}&tail=${tail}`);
  }

  async getTenantHealth(id: string): Promise<TenantHealth> {
    return this.request(`/tenants/${id}/health`);
  }

  async getTenantEvents(id: string, limit: number = 50): Promise<{ events: TenantEvent[] }> {
    return this.request(`/tenants/${id}/events?limit=${limit}`);
  }

  async upgradeTenant(id: string, version: string): Promise<{ tenant: Tenant }> {
    return this.request(`/tenants/${id}/upgrade`, {
      method: "POST",
      body: JSON.stringify({ version }),
    });
  }

  // Images
  async listImages(): Promise<{ images: PlatformImage[] }> {
    return this.request("/images");
  }

  async getLatestImage(): Promise<{ image: PlatformImage }> {
    return this.request("/images/latest");
  }

  // Health
  async getHealth(): Promise<{ status: string; checks: Record<string, { status: string; latency?: number }> }> {
    return this.request("/health");
  }

  // Backups
  async listBackups(tenantSlug?: string): Promise<{ backups: Backup[] }> {
    const query = tenantSlug ? `?tenant=${tenantSlug}` : "";
    return this.request(`/backups${query}`);
  }

  async createBackup(tenantSlug: string): Promise<{ backup: Backup }> {
    return this.request(`/backups/${tenantSlug}`, {
      method: "POST",
    });
  }

  async restoreBackup(tenantSlug: string, filename: string): Promise<{ success: boolean }> {
    return this.request(`/backups/${tenantSlug}/restore`, {
      method: "POST",
      body: JSON.stringify({ filename }),
    });
  }

  async deleteBackup(filename: string): Promise<{ success: boolean }> {
    return this.request(`/backups/${filename}`, {
      method: "DELETE",
    });
  }

  getBackupDownloadUrl(filename: string): string {
    return `${this.baseUrl}/backups/download/${filename}`;
  }
}

export const api = new ApiClient(API_URL);
