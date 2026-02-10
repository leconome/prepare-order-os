"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchOrders, fetchTenantSettings } from "@/lib/api";
import { OrderRow } from "./components/OrderRow";
import { type PreparationStatus, TABS } from "./constants";

export default function PreparationPage() {
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const filterDays = tenant?.preparationFilterDays ?? 0;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["preparation-orders", filterDays],
    queryFn: () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - filterDays);
      fromDate.setHours(0, 0, 0, 0);
      return fetchOrders({
        limit: 200,
        fromDate,
        toDate: new Date(new Date().setHours(23, 59, 59, 999)),
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
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {orders.length} commande{orders.length !== 1 ? "s" : ""}{" "}
            aujourd&apos;hui
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
