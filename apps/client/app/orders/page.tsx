"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchOrders,
  formatCurrency,
  formatDate,
  type OrderWithItems,
} from "@/lib/api";
import { PAYMENT_LABELS } from "@/lib/constants";

const PREPARATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_preparation: "En préparation",
  ready: "Prêt",
  picked_up: "Récupéré",
};

function getPaymentBadgeVariant(
  status: string,
): "paid" | "pending" | "partiallyPaid" | "refunded" | "outline" {
  switch (status) {
    case "paid":
      return "paid";
    case "pending":
      return "pending";
    case "partially_paid":
      return "partiallyPaid";
    case "refunded":
      return "refunded";
    default:
      return "outline";
  }
}

function getPreparationBadgeVariant(
  status: string,
): "pending" | "preparation" | "ready" | "pickedUp" | "outline" {
  switch (status) {
    case "ready":
      return "ready";
    case "picked_up":
      return "pickedUp";
    case "in_preparation":
      return "preparation";
    case "pending":
      return "pending";
    default:
      return "outline";
  }
}

function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucune commande trouvée
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Ticket</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Articles</TableHead>
          <TableHead>Préparation</TableHead>
          <TableHead>Paiement</TableHead>
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow
            key={order.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={`/orders/${order.id}`}
                className="block w-full hover:text-primary"
              >
                #{order.ticketNumber}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">
              <Link href={`/orders/${order.id}`} className="block w-full">
                {formatDate(order.createdAt)}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/orders/${order.id}`} className="block w-full">
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
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/orders/${order.id}`} className="block w-full">
                <Badge
                  variant={getPreparationBadgeVariant(order.preparationStatus)}
                >
                  {PREPARATION_STATUS_LABELS[order.preparationStatus] ||
                    order.preparationStatus}
                </Badge>
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/orders/${order.id}`} className="block w-full">
                <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                  {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
                </Badge>
              </Link>
            </TableCell>
            <TableCell className="text-right font-medium">
              <Link href={`/orders/${order.id}`} className="block w-full">
                {formatCurrency(order.total)}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
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

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["orders", page],
    queryFn: () => fetchOrders({ page, limit: PAGE_SIZE }),
  });

  return (
    <DashboardLayout title="Commandes" description="Gérez vos commandes">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} commandes au total
            </span>
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

        <Card>
          <CardHeader>
            <CardTitle>Commandes récentes</CardTitle>
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
