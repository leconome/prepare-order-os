"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOrder,
  updateOrderStatus,
  formatCurrency,
  formatDate,
} from "@/lib/api";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  partially_paid: "Partiellement payé",
  refunded: "Remboursé",
};

const PREPARATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_preparation: "En préparation",
  ready: "Prêt",
  picked_up: "Récupéré",
};

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();

  const {
    data: order,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: {
      paymentStatus?: string;
      preparationStatus?: string;
    }) => updateOrderStatus(orderId, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return (
    <DashboardLayout
      title={
        order ? `Commande #${order.ticketNumber}` : "Détails de la commande"
      }
      description={order ? formatDate(order.createdAt) : undefined}
    >
      <div className="space-y-6">
        <div>
          <Link href="/orders">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux commandes
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <OrderDetailSkeleton />
        ) : isError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive">
                Erreur de chargement : {(error as Error).message}
              </p>
              <Link href="/orders">
                <Button variant="outline" className="mt-4">
                  Retour aux commandes
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : order ? (
          <>
            {/* Status Cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Statut de préparation
                    </span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={order.preparationStatus}
                        onValueChange={(value) =>
                          updateStatusMutation.mutate({
                            preparationStatus: value,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="in_preparation">
                            En préparation
                          </SelectItem>
                          <SelectItem value="ready">Prêt</SelectItem>
                          <SelectItem value="picked_up">Récupéré</SelectItem>
                        </SelectContent>
                      </Select>
                      {updateStatusMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Statut de paiement
                    </span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={order.paymentStatus}
                        onValueChange={(value) =>
                          updateStatusMutation.mutate({ paymentStatus: value })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="paid">Payé</SelectItem>
                          <SelectItem value="partially_paid">
                            Partiellement payé
                          </SelectItem>
                          <SelectItem value="refunded">Remboursé</SelectItem>
                        </SelectContent>
                      </Select>
                      {updateStatusMutation.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Order Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    <span className="text-muted-foreground">Ticket :</span>{" "}
                    {order.ticketNumber}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Créée le :</span>{" "}
                    {formatDate(order.createdAt)}
                  </p>
                  {order.pickupDate && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Retrait :</span>{" "}
                      {formatDate(order.pickupDate)}
                      {order.pickupTimeStart && ` ${order.pickupTimeStart}`}
                      {order.pickupTimeEnd && ` - ${order.pickupTimeEnd}`}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.clientNote ? (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Client :</span>{" "}
                      {order.clientNote}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Pas de note client
                    </p>
                  )}
                  {order.internalNote && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Interne :</span>{" "}
                      {order.internalNote}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded bg-muted">
                        <span className="text-lg font-medium">
                          {item.quantity}x
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        {item.notes && (
                          <p className="text-sm text-muted-foreground">
                            {item.notes}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator className="my-6" />

                {/* Order Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">TVA</span>
                    <span>{formatCurrency(order.taxTotal)}</span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
