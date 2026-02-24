"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  Undo2,
  UserRound,
  UserStar,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchOrder,
  fetchStaff,
  fetchTenantSettings,
  formatCurrency,
  type OrderWithItems,
  sendSms,
  type UpdateOrderStatus,
  updateOrder,
  updateOrderStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PAYMENT_LABELS } from "@/lib/constants";
import { ItemCard } from "./components/ItemCard";
import { MenuItemCard } from "./components/MenuItemCard";
import { computeProgress } from "./helpers";

function buildSmsBody(order: OrderWithItems, shopName: string): string {
  let pickup = "";
  if (order.pickupTimeStart && order.pickupTimeEnd) {
    pickup = ` entre ${order.pickupTimeStart} et ${order.pickupTimeEnd}`;
  } else if (order.pickupTimeStart) {
    pickup = ` a ${order.pickupTimeStart}`;
  }

  const name = order.client?.name ? ` ${order.client.name}` : "";
  const shop = shopName ? ` - ${shopName}` : "";
  return `Bonjour${name}, votre commande #${order.ticketNumber} est prete${pickup}.${shop}`.slice(
    0,
    150,
  );
}

export default function PreparationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const orderId = params.id as string;
  const isOwner = user?.role === "owner" || user?.role === "admin";

  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsBody, setSmsBody] = useState("");

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

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

  const smsMutation = useMutation({
    mutationFn: async () => {
      if (!order?.client?.phone) throw new Error("No client phone");
      await sendSms({
        recipientPhone: order.client.phone,
        recipientName: order.client.name ?? undefined,
        content: smsBody,
      });
      await updateOrder(orderId, { smsNotifiedAt: new Date() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      setSmsDialogOpen(false);
    },
  });

  const openSmsDialog = () => {
    if (!order) return;
    setSmsBody(buildSmsBody(order, tenant?.name ?? ""));
    setSmsDialogOpen(true);
  };

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
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            {/* Left: Order info */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-lg">
                  #{order.ticketNumber}
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(order.total)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {order.client?.name && (
                  <div className="flex items-center gap-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {order.client.name}
                  </div>
                )}
                {pickupTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {pickupTime}
                  </div>
                )}
                {isOwner && (
                  <div className="flex items-center gap-1">
                    <UserStar className="h-3.5 w-3.5" />
                    <Select
                      value={order.assignedToId ?? "unassigned"}
                      onValueChange={(value) =>
                        assignMutation.mutate(
                          value === "unassigned" ? null : value,
                        )
                      }
                      disabled={assignMutation.isPending}
                    >
                      <SelectTrigger className="h-7 w-[160px] text-xs">
                        <SelectValue placeholder="Assigner..." />
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
            </div>

            {/* Right: CTAs */}
            <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
              {/* Payment toggle */}
              <label
                className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-1.5 transition-all select-none ${
                  order.paymentStatus === "paid"
                    ? "bg-green-50"
                    : "bg-background"
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

              {/* Send SMS */}
              {order.client?.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSmsDialog}
                  disabled={
                    order.preparationStatus !== "ready" ||
                    !!order.smsNotifiedAt ||
                    smsMutation.isPending
                  }
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  {order.smsNotifiedAt ? "SMS envoyé" : "SMS"}
                </Button>
              )}

              {/* Mark as ready (header duplicate) */}
              {order.preparationStatus !== "ready" &&
                order.preparationStatus !== "picked_up" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      statusMutation.mutate({ preparationStatus: "ready" })
                    }
                    disabled={!allPrepared || statusMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Prêt
                  </Button>
                )}

              {/* Mark as picked up (header duplicate) */}
              {order.preparationStatus === "ready" && (
                <Button
                  size="sm"
                  onClick={() =>
                    statusMutation.mutate({ preparationStatus: "picked_up" })
                  }
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Récupéré
                </Button>
              )}
            </div>
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

      {/* SMS Confirmation Dialog */}
      <Dialog
        open={smsDialogOpen}
        onOpenChange={(open) => !open && setSmsDialogOpen(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Envoyer un SMS au client</DialogTitle>
            <DialogDescription>
              SMS a {order.client?.name ?? "client"} ({order.client?.phone})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={smsBody}
              onChange={(e) => setSmsBody(e.target.value)}
              rows={6}
              maxLength={150}
            />
            <p className="text-xs text-muted-foreground text-right">
              {smsBody.length} / 150 caracteres
            </p>
            {smsMutation.isError && (
              <p className="text-sm text-destructive">
                {smsMutation.error?.message || "Erreur lors de l'envoi"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSmsDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => smsMutation.mutate()}
                disabled={!smsBody.trim() || smsMutation.isPending}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {smsMutation.isPending ? "Envoi..." : "Envoyer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
