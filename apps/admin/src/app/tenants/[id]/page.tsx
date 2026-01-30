"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/tenants/status-badge";
import { TenantActions } from "@/components/tenants/tenant-actions";
import { TenantLogs } from "@/components/tenants/tenant-logs";
import { api, type TenantWithResources, type TenantHealth, type TenantEvent, type PlatformImage } from "@/lib/api";
import { formatDate, formatBytes } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Database, Server, Cpu, HardDrive, ArrowUp, Package } from "lucide-react";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantWithResources | null>(null);
  const [health, setHealth] = useState<TenantHealth | null>(null);
  const [events, setEvents] = useState<TenantEvent[]>([]);
  const [images, setImages] = useState<PlatformImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "events">("overview");
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>("");

  const fetchData = async () => {
    try {
      const [tenantRes, healthRes, eventsRes, imagesRes] = await Promise.all([
        api.getTenant(tenantId),
        api.getTenantHealth(tenantId).catch(() => null),
        api.getTenantEvents(tenantId).catch(() => ({ events: [] })),
        api.listImages().catch(() => ({ images: [] })),
      ]);
      setTenant(tenantRes.tenant);
      setHealth(healthRes);
      setEvents(eventsRes.events);
      setImages(imagesRes.images.filter((img) => !img.isDeprecated));
    } catch (error) {
      console.error("Failed to fetch tenant:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    if (!selectedVersion || !tenant) return;

    setUpgrading(true);
    setUpgradeError(null);

    try {
      await api.upgradeTenant(tenant.id, selectedVersion);
      setSelectedVersion("");
      await fetchData();
    } catch (error) {
      setUpgradeError(error instanceof Error ? error.message : "Failed to upgrade tenant");
    } finally {
      setUpgrading(false);
    }
  };

  const latestImage = images.find((img) => img.isLatest);
  const hasNewerVersion = tenant && latestImage && tenant.medusaVersion !== latestImage.version;
  const availableUpgrades = images.filter((img) => tenant && img.version !== tenant.medusaVersion);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div>
        <Header title="Tenant Not Found" />
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-zinc-500">Tenant not found</p>
              <Link href="/tenants">
                <Button variant="link" className="mt-2">
                  Back to tenants
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title={tenant.name} />

      <div className="p-6">
        <div className="mb-6">
          <Link href="/tenants">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to Tenants
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold">{tenant.name}</h2>
              <StatusBadge status={tenant.status} />
            </div>
            <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
              <span>Slug: {tenant.slug}</span>
              <a
                href={`http://${tenant.subdomain}.localhost`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-zinc-900"
              >
                {tenant.subdomain}.localhost
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <TenantActions tenant={tenant} onUpdate={fetchData} />
        </div>

        <div className="mb-6 flex gap-2 border-b">
          {(["overview", "logs", "events"] as const).map((tab) => (
            <button
              key={tab}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                activeTab === tab
                  ? "border-b-2 border-zinc-900 text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-500">Admin Email</span>
                    <p className="font-medium">{tenant.adminEmail || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Created</span>
                    <p className="font-medium">{formatDate(tenant.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Medusa Version</span>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {tenant.medusaVersion || "Default"}
                      </p>
                      {hasNewerVersion && (
                        <Badge variant="warning" className="text-xs">
                          Upgrade Available
                        </Badge>
                      )}
                    </div>
                  </div>
                  {tenant.lastUpgradedAt && (
                    <div>
                      <span className="text-zinc-500">Last Upgraded</span>
                      <p className="font-medium">{formatDate(tenant.lastUpgradedAt)}</p>
                    </div>
                  )}
                  {tenant.config.medusaPort && (
                    <div>
                      <span className="text-zinc-500">API Port</span>
                      <p className="font-medium">{tenant.config.medusaPort}</p>
                    </div>
                  )}
                  {tenant.config.adminPort && (
                    <div>
                      <span className="text-zinc-500">Admin Port</span>
                      <p className="font-medium">{tenant.config.adminPort}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tenant.resources.map((resource) => {
                    const containerHealth = health?.containers[resource.resourceType];
                    return (
                      <div
                        key={resource.resourceType}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {resource.resourceType === "postgres" && (
                            <Database className="h-4 w-4 text-blue-500" />
                          )}
                          {resource.resourceType === "redis" && (
                            <Server className="h-4 w-4 text-red-500" />
                          )}
                          {resource.resourceType === "medusa" && (
                            <Cpu className="h-4 w-4 text-purple-500" />
                          )}
                          {resource.resourceType === "network" && (
                            <HardDrive className="h-4 w-4 text-zinc-500" />
                          )}
                          <div>
                            <span className="font-medium capitalize">
                              {resource.resourceType}
                            </span>
                            {resource.port && (
                              <span className="ml-2 text-sm text-zinc-500">
                                :{resource.port}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {containerHealth?.stats && (
                            <div className="flex gap-3 text-xs text-zinc-500">
                              <span>CPU: {containerHealth.stats.cpu}%</span>
                              <span>RAM: {containerHealth.stats.memory}MB</span>
                            </div>
                          )}
                          <Badge
                            variant={
                              containerHealth?.status === "running" ||
                              resource.status === "running"
                                ? "success"
                                : resource.status === "stopped"
                                ? "secondary"
                                : "destructive"
                            }
                          >
                            {containerHealth?.status || resource.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {tenant.status === "running" && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Quick Links</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <a
                      href={`http://${tenant.subdomain}.localhost`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Store API
                      </Button>
                    </a>
                    <a
                      href={`http://${tenant.subdomain}.localhost/app`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Admin Dashboard
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

            {(tenant.status === "running" || tenant.status === "stopped") && availableUpgrades.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Version Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-zinc-500">Current Version:</span>
                      <Badge variant="outline">{tenant.medusaVersion || "Default"}</Badge>
                      {hasNewerVersion && latestImage && (
                        <span className="text-zinc-500">
                          → Latest: <span className="font-medium text-green-600">{latestImage.version}</span>
                        </span>
                      )}
                    </div>

                    {upgradeError && (
                      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                        {upgradeError}
                      </div>
                    )}

                    <div className="flex items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <label htmlFor="version-select" className="text-sm font-medium">
                          Upgrade to Version
                        </label>
                        <select
                          id="version-select"
                          value={selectedVersion}
                          onChange={(e) => setSelectedVersion(e.target.value)}
                          disabled={upgrading}
                          className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select version...</option>
                          {availableUpgrades.map((image) => (
                            <option key={image.id} value={image.version}>
                              {image.version}
                              {image.isLatest && " (Latest)"}
                              {image.createdAt && ` - ${new Date(image.createdAt).toLocaleDateString()}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={handleUpgrade}
                        disabled={!selectedVersion || upgrading}
                        loading={upgrading}
                      >
                        <ArrowUp className="mr-2 h-4 w-4" />
                        Upgrade
                      </Button>
                    </div>

                    <p className="text-xs text-zinc-500">
                      Note: Upgrading will briefly stop the Medusa container while the new version is deployed.
                      Data in the database will be preserved.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <Card>
            <CardHeader>
              <CardTitle>Container Logs</CardTitle>
            </CardHeader>
            <CardContent>
              <TenantLogs tenantId={tenantId} />
            </CardContent>
          </Card>
        )}

        {activeTab === "events" && (
          <Card>
            <CardHeader>
              <CardTitle>Event History</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-center text-zinc-500">No events yet</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 rounded-lg border p-3"
                    >
                      <Badge variant="outline" className="capitalize">
                        {event.eventType.replace(/_/g, " ")}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm">{event.message}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(event.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
