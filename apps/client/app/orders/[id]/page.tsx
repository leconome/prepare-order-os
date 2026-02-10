"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  UserStar,
} from "lucide-react";
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
  formatCurrency,
  formatDate,
  updateOrderStatus,
} from "@/lib/api";
import { PAYMENT_LABELS, PREPARATION_STATUS_LABELS } from "@/lib/constants";
import {
  getPaymentBadgeVariant,
  getPreparationBadgeVariant,
} from "@/lib/helpers";

function OrderDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement..." description="">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux commandes
            </Link>
          </Button>
          <OrderDetailSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !order) {
    return (
      <DashboardLayout title="Commande non trouvée" description="">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux commandes
            </Link>
          </Button>
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {isError
                ? `Erreur: ${(error as Error).message}`
                : "Cette commande n'existe pas."}
            </p>
            <Button asChild className="mt-4">
              <Link href="/orders">Voir toutes les commandes</Link>
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`Commande #${order.ticketNumber}`}
      description={`Créée le ${formatDate(order.createdAt)}`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/orders">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux commandes
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Badge
              variant={getPreparationBadgeVariant(order.preparationStatus)}
            >
              {PREPARATION_STATUS_LABELS[order.preparationStatus] ||
                order.preparationStatus}
            </Badge>
            <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
              {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Order Items */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Articles ({order.items?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {order.items && order.items.length > 0 ? (
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between rounded-lg border p-3"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(item.unitPrice)} x {item.quantity}
                          </div>
                          {item.notes && (
                            <div className="text-sm text-muted-foreground italic">
                              Note: {item.notes}
                            </div>
                          )}
                        </div>
                        <div className="text-right font-medium">
                          {formatCurrency(item.totalPrice)}
                        </div>
                      </div>
                    ))}

                    <Separator className="my-4" />

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Sous-total
                        </span>
                        <span>{formatCurrency(order.subtotal)}</span>
                      </div>
                      {parseFloat(order.taxTotal) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Taxes</span>
                          <span>{formatCurrency(order.taxTotal)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-medium text-lg pt-2 border-t">
                        <span>Total</span>
                        <span>{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    Aucun article dans cette commande
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            {(order.clientNote || order.internalNote) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {order.clientNote && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        Note client
                      </div>
                      <div className="rounded-lg bg-muted p-3 text-sm">
                        {order.clientNote}
                      </div>
                    </div>
                  )}
                  {order.internalNote && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground mb-1">
                        Note interne
                      </div>
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm">
                        {order.internalNote}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Info Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Informations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Ticket
                      </div>
                      <div className="font-medium">#{order.ticketNumber}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Créée le
                      </div>
                      <div className="font-medium">
                        {formatDate(order.createdAt)}
                      </div>
                    </div>
                  </div>

                  {order.pickupDate && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <Clock className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Retrait prévu
                        </div>
                        <div className="font-medium">
                          {format(new Date(order.pickupDate), "PPP", {
                            locale: fr,
                          })}
                          {order.pickupTimeStart && order.pickupTimeEnd && (
                            <span className="text-muted-foreground">
                              {" "}
                              ({order.pickupTimeStart} - {order.pickupTimeEnd})
                            </span>
                          )}
                          {order.pickupTimeStart && !order.pickupTimeEnd && (
                            <span className="text-muted-foreground">
                              {" "}
                              (à partir de {order.pickupTimeStart})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Staff Info */}
            {(order.createdBy || order.assignedTo) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserStar className="h-5 w-5" />
                    Équipe
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.createdBy && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <UserStar className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Créée par
                        </div>
                        <div className="font-medium">
                          {order.createdBy.name}
                        </div>
                      </div>
                    </div>
                  )}
                  {order.assignedTo && (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <UserStar className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">
                          Assignée à
                        </div>
                        <div className="font-medium">
                          {order.assignedTo.name}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle>Modifier les statuts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Préparation
                  </label>
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
                      <SelectTrigger className="w-full">
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
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Paiement
                  </label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={order.paymentStatus}
                      onValueChange={(value) =>
                        updateStatusMutation.mutate({ paymentStatus: value })
                      }
                      disabled={updateStatusMutation.isPending}
                    >
                      <SelectTrigger className="w-full">
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
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
