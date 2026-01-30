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
import { api, type TenantWithResources, type TenantHealth, type TenantEvent } from "@/lib/api";
import { formatDate, formatBytes } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Database, Server, Cpu, HardDrive } from "lucide-react";

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantWithResources | null>(null);
  const [health, setHealth] = useState<TenantHealth | null>(null);
  const [events, setEvents] = useState<TenantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "logs" | "events">("overview");

  const fetchData = async () => {
    try {
      const [tenantRes, healthRes, eventsRes] = await Promise.all([
        api.getTenant(tenantId),
        api.getTenantHealth(tenantId).catch(() => null),
        api.getTenantEvents(tenantId).catch(() => ({ events: [] })),
      ]);
      setTenant(tenantRes.tenant);
      setHealth(healthRes);
      setEvents(eventsRes.events);
    } catch (error) {
      console.error("Failed to fetch tenant:", error);
    } finally {
      setLoading(false);
    }
  };

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
