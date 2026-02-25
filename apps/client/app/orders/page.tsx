"use client";

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteOrder,
  fetchOrders,
  formatCurrency,
  type OrdersResponse,
  type OrderWithItems,
} from "@/lib/api";
import { PAYMENT_LABELS, PREPARATION_STATUS_LABELS } from "@/lib/constants";
import {
  getPaymentBadgeVariant,
  getPreparationBadgeVariant,
} from "@/lib/helpers";

function formatPickupDate(order: OrderWithItems): string | null {
  if (!order.pickupDate) return null;
  const date = new Date(order.pickupDate);
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
  if (order.pickupTimeStart && order.pickupTimeEnd) {
    return `${formatted}, ${order.pickupTimeStart}-${order.pickupTimeEnd}`;
  }
  return formatted;
}

const ORDER_TABS = [
  { key: "all", label: "Toutes", status: undefined },
  { key: "pending", label: "En attente", status: "pending" as const },
  {
    key: "in_preparation",
    label: "En préparation",
    status: "in_preparation" as const,
  },
  { key: "ready", label: "Prêt", status: "ready" as const },
  { key: "picked_up", label: "Récupéré", status: "picked_up" as const },
];

function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<OrderWithItems | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders-count"] });
      setDeleteTarget(null);
    },
  });

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucune commande trouvée
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Ticket</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Retrait</TableHead>
            <TableHead>Articles</TableHead>
            <TableHead>Préparation</TableHead>
            <TableHead>Paiement</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => router.push(`/orders/${order.id}`)}
            >
              <TableCell className="font-medium">
                #{order.ticketNumber}
              </TableCell>
              <TableCell>
                {order.client?.name ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {formatPickupDate(order) ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {order.items?.slice(0, 2).map((item) => (
                    <span key={item.id} className="text-sm">
                      {item.quantity}x {item.productName}
                    </span>
                  ))}
                  {order.items && order.items.length > 2 && (
                    <span className="text-sm text-muted-foreground">
                      +{order.items.length - 2} autres
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant={getPreparationBadgeVariant(order.preparationStatus)}
                >
                  {PREPARATION_STATUS_LABELS[order.preparationStatus] ||
                    order.preparationStatus}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                  {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(order.total)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(order);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la commande</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la commande #
              {deleteTarget?.ticketNumber} ? Cette action est irréversible et le
              stock sera restauré.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-sm text-destructive">
              Erreur: {(deleteMutation.error as Error).message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteTarget && deleteMutation.mutate(deleteTarget.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const trimmedSearch = search.trim();

  const activeStatus = ORDER_TABS.find((t) => t.key === activeTab)?.status;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["orders", page, trimmedSearch, activeStatus],
    queryFn: () =>
      fetchOrders({
        page,
        limit: PAGE_SIZE,
        search: trimmedSearch || undefined,
        preparationStatus: activeStatus,
      }),
    placeholderData: keepPreviousData,
  });

  const countQueries = useQueries({
    queries: ORDER_TABS.map((tab) => ({
      queryKey: ["orders-count", tab.status ?? "all", trimmedSearch],
      queryFn: () =>
        fetchOrders({
          page: 1,
          limit: 1,
          preparationStatus: tab.status,
          search: trimmedSearch || undefined,
        }),
      select: (d: OrdersResponse) => d.pagination.total,
    })),
  });

  return (
    <DashboardLayout title="Commandes" description="Gérez vos commandes">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher par client, produit, ticket..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              asChild
            >
              <Link href="/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle commande
              </Link>
            </Button>
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            setPage(1);
          }}
        >
          <TabsList>
            {ORDER_TABS.map((tab, i) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-xs h-5 px-1.5"
                >
                  {countQueries[i]?.data ?? 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>Commandes récentes</CardTitle>
            <CardAction>
              <div className="flex flex-row items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {data?.pagination.total ?? 0} commandes
                </span>
                {(data?.pagination.totalPages ?? 1) > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage((p) => p - 1)}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {page}/{data?.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= (data?.pagination.totalPages ?? 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </CardAction>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <OrdersTableSkeleton />
            ) : isError ? (
              <div className="py-12 text-center">
                <p className="text-destructive">
                  Erreur de chargement : {(error as Error).message}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  Réessayer
                </Button>
              </div>
            ) : (
              <>
                <OrdersTable orders={data?.data ?? []} />
                <TablePagination
                  page={data?.pagination.page ?? 1}
                  totalPages={data?.pagination.totalPages ?? 1}
                  total={data?.pagination.total ?? 0}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
