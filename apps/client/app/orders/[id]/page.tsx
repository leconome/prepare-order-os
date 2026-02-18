"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { updateOrderSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  CalendarIcon,
  Coffee,
  FileText,
  Loader2,
  MessageSquare,
  Package,
  Save,
  Search,
  Sun,
  Sunset,
  Undo2,
  UserRound,
  UserStar,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchClients,
  fetchOrder,
  fetchStaff,
  formatCurrency,
  formatDate,
  type UpdateOrder,
  updateOrder,
  updateOrderStatus,
} from "@/lib/api";
import { PAYMENT_LABELS, PREPARATION_STATUS_LABELS } from "@/lib/constants";
import {
  getPaymentBadgeVariant,
  getPreparationBadgeVariant,
} from "@/lib/helpers";
import { cn } from "@/lib/utils";

const editOrderSchema = updateOrderSchema.omit({
  paymentStatus: true,
  preparationStatus: true,
  smsNotifiedAt: true,
});

type TimeInterval = {
  id: string;
  label: string;
  timeStart: string;
  timeEnd: string;
  icon: React.ReactNode;
  color: string;
};

const TIME_INTERVALS: TimeInterval[] = [
  {
    id: "matin",
    label: "Matin",
    timeStart: "09:00",
    timeEnd: "12:00",
    icon: <Coffee className="h-5 w-5" />,
    color: "from-amber-400 to-orange-500",
  },
  {
    id: "midi",
    label: "Midi",
    timeStart: "12:00",
    timeEnd: "14:00",
    icon: <Sun className="h-5 w-5" />,
    color: "from-yellow-400 to-amber-500",
  },
  {
    id: "apres-midi",
    label: "Après-midi",
    timeStart: "14:00",
    timeEnd: "18:00",
    icon: <Sunset className="h-5 w-5" />,
    color: "from-orange-400 to-rose-500",
  },
];

function getSelectedInterval(
  timeStart: string | null | undefined,
  timeEnd: string | null | undefined,
): string | null {
  if (!timeStart || !timeEnd) return null;
  const match = TIME_INTERVALS.find(
    (i) => i.timeStart === timeStart && i.timeEnd === timeEnd,
  );
  return match?.id ?? null;
}

type ClientDisplay = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

function orderToFormValues(order: {
  clientId?: string | null;
  pickupDate?: string | Date | null;
  pickupTimeStart?: string | null;
  pickupTimeEnd?: string | null;
  clientNote?: string | null;
  internalNote?: string | null;
  assignedToId?: string | null;
}): UpdateOrder {
  return {
    clientId: order.clientId ?? null,
    pickupDate: order.pickupDate ? new Date(order.pickupDate) : null,
    pickupTimeStart: order.pickupTimeStart ?? null,
    pickupTimeEnd: order.pickupTimeEnd ?? null,
    clientNote: order.clientNote ?? null,
    internalNote: order.internalNote ?? null,
    assignedToId: order.assignedToId ?? null,
  };
}

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const queryClient = useQueryClient();

  const [selectedClient, setSelectedClient] = useState<ClientDisplay | null>(
    null,
  );
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  const form = useForm<UpdateOrder>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      clientId: null,
      pickupDate: null,
      pickupTimeStart: null,
      pickupTimeEnd: null,
      clientNote: null,
      internalNote: null,
      assignedToId: null,
    },
  });

  const { isDirty } = form.formState;
  const watchedTimeStart = form.watch("pickupTimeStart");
  const watchedTimeEnd = form.watch("pickupTimeEnd");
  const selectedInterval = getSelectedInterval(
    watchedTimeStart,
    watchedTimeEnd,
  );

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

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff({ limit: 100, isActive: true }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", clientSearchQuery],
    queryFn: () =>
      fetchClients({ limit: 20, search: clientSearchQuery || undefined }),
  });

  // Sync form with order data
  useEffect(() => {
    if (!order) return;
    form.reset(orderToFormValues(order));
    setSelectedClient(order.client ?? null);
  }, [order, form]);

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

  const updateOrderMutation = useMutation({
    mutationFn: (data: UpdateOrder) => updateOrder(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    updateOrderMutation.mutate(data);
  });

  const handleReset = () => {
    if (!order) return;
    form.reset(orderToFormValues(order));
    setSelectedClient(order.client ?? null);
    setClientSearchQuery("");
  };

  const handleIntervalSelect = (interval: TimeInterval) => {
    if (selectedInterval === interval.id) {
      form.setValue("pickupTimeStart", null, { shouldDirty: true });
      form.setValue("pickupTimeEnd", null, { shouldDirty: true });
    } else {
      form.setValue("pickupTimeStart", interval.timeStart, {
        shouldDirty: true,
      });
      form.setValue("pickupTimeEnd", interval.timeEnd, { shouldDirty: true });
    }
  };

  const handleClientSelect = (client: ClientDisplay) => {
    setSelectedClient(client);
    form.setValue("clientId", client.id, { shouldDirty: true });
    setClientSearchQuery("");
  };

  const handleClientClear = () => {
    setSelectedClient(null);
    form.setValue("clientId", null, { shouldDirty: true });
  };

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

  const hasBeenModified =
    order.updatedAt &&
    order.createdAt &&
    new Date(order.updatedAt).getTime() - new Date(order.createdAt).getTime() >
      1000;

  return (
    <DashboardLayout
      title={`Commande #${order.ticketNumber}`}
      description={`Créée le ${formatDate(order.createdAt)}${order.pickupDate ? ` · Retrait le ${format(new Date(order.pickupDate), "EEEE d MMMM", { locale: fr })}${order.pickupTimeStart ? ` (${order.pickupTimeStart}-${order.pickupTimeEnd})` : ""}` : ""}`}
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
            {isDirty ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={updateOrderMutation.isPending}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  Annuler
                </Button>
                <Button
                  size="sm"
                  onClick={onSubmit}
                  disabled={updateOrderMutation.isPending}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  {updateOrderMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Sauvegarder
                </Button>
              </>
            ) : (
              <>
                <Badge
                  variant={getPreparationBadgeVariant(order.preparationStatus)}
                >
                  {PREPARATION_STATUS_LABELS[order.preparationStatus] ||
                    order.preparationStatus}
                </Badge>
                <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                  {PAYMENT_LABELS[order.paymentStatus] || order.paymentStatus}
                </Badge>
              </>
            )}
          </div>
        </div>

        {updateOrderMutation.isError && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            Erreur: {(updateOrderMutation.error as Error).message}
          </div>
        )}

        <Form {...form}>
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
                            <div className="font-medium">
                              {item.productName}
                            </div>
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="clientNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note client</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Instructions du client..."
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="internalNote"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note interne</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Notes internes (non visibles par le client)..."
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
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
                        {hasBeenModified && (
                          <div className="text-sm text-muted-foreground">
                            Modifié le {formatDate(order.updatedAt)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pickup date & time */}
                  <div className="space-y-3">
                    <FormField
                      control={form.control}
                      name="pickupDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date de retrait</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "EEEE d MMMM yyyy", {
                                      locale: fr,
                                    })
                                  ) : (
                                    <span>Choisir une date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <CalendarComponent
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={(date) =>
                                  field.onChange(date ?? null)
                                }
                                initialFocus
                                locale={fr}
                              />
                            </PopoverContent>
                          </Popover>
                          {field.value && (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="w-full text-muted-foreground"
                              onClick={() => field.onChange(null)}
                            >
                              <X className="mr-2 h-3 w-3" />
                              Retirer la date
                            </Button>
                          )}
                        </FormItem>
                      )}
                    />

                    <div className="text-sm font-medium">
                      Créneau de retrait
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {TIME_INTERVALS.map((interval) => (
                        <button
                          key={interval.id}
                          type="button"
                          onClick={() => handleIntervalSelect(interval)}
                          className={cn(
                            "relative flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all hover:scale-[1.02]",
                            selectedInterval === interval.id
                              ? "border-transparent bg-gradient-to-br text-white shadow-lg " +
                                  interval.color
                              : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full",
                              selectedInterval === interval.id
                                ? "bg-white/20"
                                : "bg-gradient-to-br " +
                                    interval.color +
                                    " text-white",
                            )}
                          >
                            {interval.icon}
                          </div>
                          <div className="text-center">
                            <div className="text-xs font-semibold">
                              {interval.label}
                            </div>
                            <div
                              className={cn(
                                "text-[10px]",
                                selectedInterval === interval.id
                                  ? "text-white/80"
                                  : "text-muted-foreground",
                              )}
                            >
                              {interval.timeStart}-{interval.timeEnd}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Client */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserRound className="h-5 w-5" />
                    Client
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedClient && (
                      <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm text-white shrink-0">
                            {selectedClient.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">
                              {selectedClient.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {selectedClient.phone ||
                                selectedClient.email ||
                                "Aucun contact"}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClientClear}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}

                    {!selectedClient && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Rechercher un client..."
                            value={clientSearchQuery}
                            onChange={(e) =>
                              setClientSearchQuery(e.target.value)
                            }
                            className="pl-10"
                          />
                        </div>

                        {clientsData?.data && clientsData.data.length > 0 && (
                          <div className="max-h-[200px] overflow-y-auto space-y-1 rounded-lg border p-2">
                            {clientsData.data.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => handleClientSelect(client)}
                                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted transition-colors"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
                                  {client.name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {client.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {client.phone ||
                                      client.email ||
                                      "Aucun contact"}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {clientSearchQuery &&
                          clientsData?.data?.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              Aucun client trouvé
                            </p>
                          )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Staff */}
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
                  <FormField
                    control={form.control}
                    name="assignedToId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignée à</FormLabel>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(v) => field.onChange(v || null)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un membre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {staffData?.data.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name || user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.value && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="w-full mt-1 text-muted-foreground"
                            onClick={() => field.onChange(null)}
                          >
                            <X className="mr-2 h-3 w-3" />
                            Retirer l'assignation
                          </Button>
                        )}
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Status Management */}
              <Card>
                <CardHeader>
                  <CardTitle>Statuts</CardTitle>
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
                          updateStatusMutation.mutate({
                            paymentStatus: value,
                          })
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
        </Form>
      </div>
    </DashboardLayout>
  );
}

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
