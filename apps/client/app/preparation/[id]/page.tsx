"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Undo2,
  UserRound,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOrder,
  fetchStaff,
  formatCurrency,
  type UpdateOrderStatus,
  updateOrder,
  updateOrderStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ItemCard } from "./components/ItemCard";
import { MenuItemCard } from "./components/MenuItemCard";
import { PAYMENT_LABELS } from "./constants";
import { computeProgress } from "./helpers";

export default function PreparationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const orderId = params.id as string;
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    refetchInterval: 15000,
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff({ limit: 100 }),
    enabled: isOwner,
  });

  const statusMutation = useMutation({
    mutationFn: (data: UpdateOrderStatus) => updateOrderStatus(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["preparation-orders"] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      updateOrder(orderId, { assignedToId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["preparation-orders"] });
    },
  });

  const togglePayment = () => {
    const next = order?.paymentStatus === "paid" ? "pending" : "paid";
    statusMutation.mutate({ paymentStatus: next });
  };

  if (isLoading) {
    return (
      <DashboardLayout title="Préparation" description="Chargement...">
        <div className="space-y-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout title="Préparation" description="Commande introuvable">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Commande introuvable</p>
          <Button variant="outline" onClick={() => router.push("/preparation")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const items = order.items ?? [];
  const toPrepare = items.filter((i) => !i.isPrepared);
  const prepared = items.filter((i) => i.isPrepared);
  const { totalUnits, preparedUnits } = computeProgress(items);
  const progressPercent =
    totalUnits > 0 ? (preparedUnits / totalUnits) * 100 : 0;
  const allPrepared = totalUnits > 0 && preparedUnits === totalUnits;

  const pickupTime =
    order.pickupTimeStart && order.pickupTimeEnd
      ? `${order.pickupTimeStart}–${order.pickupTimeEnd}`
      : order.pickupTimeStart || null;

  return (
    <DashboardLayout
      title={`Commande #${order.ticketNumber}`}
      description="Préparation de commande"
    >
      <div className="space-y-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/preparation")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>

        {/* Header card */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Ticket */}
            <div>
              <span className="font-mono font-bold text-lg">
                #{order.ticketNumber}
              </span>
            </div>

            {/* Client */}
            {order.client?.name && (
              <div className="flex items-center gap-1 text-sm">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                {order.client.name}
              </div>
            )}

            {/* Pickup time */}
            {pickupTime && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {pickupTime}
              </div>
            )}

            {/* Total */}
            <div className="text-sm font-medium">
              {formatCurrency(order.total)}
            </div>

            {/* Payment toggle */}
            <label
              className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-1.5 transition-all select-none ${
                order.paymentStatus === "paid" ? "bg-green-50" : "bg-background"
              }`}
            >
              <Checkbox
                checked={order.paymentStatus === "paid"}
                onCheckedChange={() => togglePayment()}
                disabled={statusMutation.isPending}
                className="h-4 w-4 bg-white data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
              />
              <span
                className={`text-sm font-medium ${
                  order.paymentStatus === "paid"
                    ? "text-green-700"
                    : "text-gray-700"
                }`}
              >
                {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
              </span>
            </label>

            {/* Assigned to — owner only */}
            {isOwner && (
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={order.assignedToId ?? "unassigned"}
                  onValueChange={(value) =>
                    assignMutation.mutate(value === "unassigned" ? null : value)
                  }
                  disabled={assignMutation.isPending}
                >
                  <SelectTrigger className="h-8 w-[180px] text-sm">
                    <SelectValue placeholder="Assigner à..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Non assigné</SelectItem>
                    {staffData?.data?.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progression</span>
              <span className="font-medium">
                {preparedUnits} / {totalUnits} éléments préparés
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
          </div>

          {/* Client & internal notes */}
          {(order.clientNote || order.internalNote) && (
            <div className="mt-3 space-y-1 text-sm">
              {order.clientNote && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Note client :</span>{" "}
                  {order.clientNote}
                </p>
              )}
              {order.internalNote && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Note interne :</span>{" "}
                  {order.internalNote}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Two columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left: To prepare */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-sm font-medium">A preparer</span>
              <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                {toPrepare.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-25">
              {toPrepare.length === 0 ? (
                <div className="flex items-center justify-center h-24 rounded-lg border border-dashed text-xs text-muted-foreground">
                  Tous les articles sont prepares
                </div>
              ) : (
                toPrepare.map((item) =>
                  item.isMenu ? (
                    <MenuItemCard key={item.id} item={item} orderId={orderId} />
                  ) : (
                    <ItemCard
                      key={item.id}
                      item={item}
                      orderId={orderId}
                      isPreparedSide={false}
                    />
                  ),
                )
              )}
            </div>
          </div>

          {/* Right: Prepared */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-medium">Prepare</span>
              <Badge variant="secondary" className="ml-auto text-xs h-5 px-1.5">
                {prepared.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-25">
              {prepared.length === 0 ? (
                <div className="flex items-center justify-center h-24 rounded-lg border border-dashed text-xs text-muted-foreground">
                  Aucun article prepare
                </div>
              ) : (
                prepared.map((item) =>
                  item.isMenu ? (
                    <MenuItemCard key={item.id} item={item} orderId={orderId} />
                  ) : (
                    <ItemCard
                      key={item.id}
                      item={item}
                      orderId={orderId}
                      isPreparedSide={true}
                    />
                  ),
                )
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 pt-2">
          {order.preparationStatus !== "pending" &&
            order.preparationStatus !== "picked_up" && (
              <Button
                variant="outline"
                onClick={() =>
                  statusMutation.mutate({ preparationStatus: "pending" })
                }
                disabled={statusMutation.isPending}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                Retour en attente
              </Button>
            )}

          {order.preparationStatus !== "ready" &&
            order.preparationStatus !== "picked_up" && (
              <Button
                onClick={() =>
                  statusMutation.mutate({ preparationStatus: "ready" })
                }
                disabled={!allPrepared || statusMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <Check className="mr-2 h-4 w-4" />
                Marquer comme prêt
              </Button>
            )}

          {order.preparationStatus === "ready" && (
            <Button
              onClick={() =>
                statusMutation.mutate({ preparationStatus: "picked_up" })
              }
              disabled={statusMutation.isPending}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Marquer comme récupéré
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
