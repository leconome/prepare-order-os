"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchOrders, fetchPointsOfSale, fetchTenantSettings } from "@/lib/api";
import { OrderRow } from "./components/OrderRow";
import { type PreparationStatus, TABS } from "./constants";

export default function PreparationPage() {
  return (
    <Suspense>
      <PreparationPageContent />
    </Suspense>
  );
}

function PreparationPageContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const defaultTab = TABS.some((t) => t.key === tabParam)
    ? (tabParam as string)
    : "to_prepare";
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("all");

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const { data: posData } = useQuery({
    queryKey: ["points-of-sale"],
    queryFn: () => fetchPointsOfSale({ limit: 100 }),
  });

  const filterDays = tenant?.preparationFilterDays ?? 0;
  const trimmedSearch = search.trim();
  const posId = posFilter !== "all" ? posFilter : undefined;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["preparation-orders", trimmedSearch, posId],
    queryFn: () =>
      fetchOrders({
        limit: 200,
        search: trimmedSearch || undefined,
        posId,
      }),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const allOrders = data?.data ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Show future orders + past orders unless already picked up
  const orders = allOrders.filter((o) => {
    const pickup = o.pickupDate ? new Date(o.pickupDate) : null;
    if (!pickup) return o.preparationStatus !== "picked_up";
    if (pickup >= todayStart) return true;
    return o.preparationStatus !== "picked_up";
  });

  const tabData = TABS.map((tab) => ({
    ...tab,
    orders: orders
      .filter((o) =>
        tab.statuses.includes(o.preparationStatus as PreparationStatus),
      )
      .sort((a, b) => {
        // picked_up orders go last
        const pa = a.preparationStatus === "picked_up" ? 1 : 0;
        const pb = b.preparationStatus === "picked_up" ? 1 : 0;
        if (pa !== pb) return pa - pb;
        const da = a.pickupDate ? new Date(a.pickupDate).getTime() : 0;
        const db = b.pickupDate ? new Date(b.pickupDate).getTime() : 0;
        return da - db;
      }),
  }));

  return (
    <DashboardLayout
      title="Préparation"
      description="Suivi des préparations du jour"
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
            <Select
              value={posFilter}
              onValueChange={setPosFilter}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Lieu de retrait" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les lieux</SelectItem>
                {posData?.data?.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Tabs defaultValue={defaultTab}>
            <TabsList>
              {tabData.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                >
                  <tab.icon className="h-4 w-4" />
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
                <div className="grid grid-cols-8 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-6">Commande</div>
                  <div className="col-span-2">Statut</div>
                </div>
                {tab.orders.length === 0 ? (
                  <div className="flex items-center justify-center h-32 rounded-lg border border-dashed text-sm text-muted-foreground">
                    Aucune commande
                  </div>
                ) : (
                  <div className="rounded-lg overflow-hidden border-2">
                    {tab.orders.map((order, index) => (
                      <OrderRow key={order.id} order={order} even={index % 2 === 0} />
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
