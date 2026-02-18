"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, X } from "lucide-react";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchOrders, fetchTenantSettings } from "@/lib/api";
import { OrderRow } from "./components/OrderRow";
import { type PreparationStatus, TABS } from "./constants";

export default function PreparationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const filterDays = tenant?.preparationFilterDays ?? 0;
  const trimmedSearch = search.trim();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["preparation-orders", filterDays, trimmedSearch],
    queryFn: () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - filterDays);
      fromDate.setHours(0, 0, 0, 0);
      return fetchOrders({
        limit: 200,
        fromDate,
        toDate: new Date(new Date().setHours(23, 59, 59, 999)),
        search: trimmedSearch || undefined,
      });
    },
    refetchInterval: 30000,
  });

  const orders = data?.data ?? [];

  const tabData = TABS.map((tab) => ({
    ...tab,
    orders: orders.filter((o) =>
      tab.statuses.includes(o.preparationStatus as PreparationStatus),
    ),
  }));

  return (
    <DashboardLayout
      title="Préparation"
      description="Suivi des commandes du jour"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client, produit, ticket..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {orders.length} commande{orders.length !== 1 ? "s" : ""}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["preparation-orders"],
                })
              }
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-80" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`skel-${i}`} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="to_prepare">
            <TabsList>
              {tabData.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key}>
                  {tab.label}
                  <Badge
                    variant="secondary"
                    className="ml-1.5 text-xs h-5 px-1.5"
                  >
                    {tab.orders.length}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>

            {tabData.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                <div className="grid grid-cols-10 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-6">Commande</div>
                  <div className="col-span-2">Paiement</div>
                  <div className="col-span-2">Statut</div>
                </div>
                {tab.orders.length === 0 ? (
                  <div className="flex items-center justify-center h-32 rounded-lg border border-dashed text-sm text-muted-foreground">
                    Aucune commande
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tab.orders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
