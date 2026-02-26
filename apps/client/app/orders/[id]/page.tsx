"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSchema, updateOrderSchema, UNIT_CONFIG, formatQtyLabel, lineTotal, roundQty, parseQty, type Unit } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Calendar,
  CalendarIcon,
  ChefHat,
  Coffee,
  FileText,
  Check,
  Loader2,
  MessageSquare,
  Minus,
  Package,
  Pencil,
  Plus,
  Save,
  Search,
  ShoppingCart,
  Sun,
  Sunset,
  Trash2,
  Undo2,
  UserPlus,
  UserRound,
  UserStar,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type CreateClient,
  createClient,
  deleteOrder,
  fetchClients,
  fetchMenus,
  fetchOrder,
  fetchProducts,
  fetchStaff,
  formatCurrency,
  formatDate,
  type Product,
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
  items: true,
});

type EditOrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  notes?: string;
  menuId?: string;
  unit: Unit;
};

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
  createdById?: string | null;
  assignedToId?: string | null;
}): UpdateOrder {
  return {
    clientId: order.clientId ?? null,
    pickupDate: order.pickupDate ? new Date(order.pickupDate) : null,
    pickupTimeStart: order.pickupTimeStart ?? null,
    pickupTimeEnd: order.pickupTimeEnd ?? null,
    clientNote: order.clientNote ?? null,
    internalNote: order.internalNote ?? null,
    createdById: order.createdById ?? null,
    assignedToId: order.assignedToId ?? null,
  };
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const queryClient = useQueryClient();

  const [selectedClient, setSelectedClient] = useState<ClientDisplay | null>(
    null,
  );
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [showNewClientForm, setShowNewClientForm] = useState(false);

  const clientForm = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    },
  });

  const createClientMutation = useMutation({
    mutationFn: createClient,
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setSelectedClient(newClient);
      form.setValue("clientId", newClient.id, { shouldDirty: true });
      setShowNewClientForm(false);
      clientForm.reset();
    },
  });

  const handleQuickClientCreate = clientForm.handleSubmit((data) => {
    createClientMutation.mutate(data as CreateClient);
  });

  const form = useForm<UpdateOrder>({
    resolver: zodResolver(editOrderSchema),
    defaultValues: {
      clientId: null,
      pickupDate: null,
      pickupTimeStart: null,
      pickupTimeEnd: null,
      clientNote: null,
      internalNote: null,
      createdById: null,
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

  // Item editing state
  const [isEditingItems, setIsEditingItems] = useState(false);
  const [editableItems, setEditableItems] = useState<EditOrderItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [editDiscountType, setEditDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [editDiscountValue, setEditDiscountValue] = useState("");

  const { data: productsData } = useQuery({
    queryKey: ["products", productSearchQuery],
    queryFn: () =>
      fetchProducts({
        limit: 50,
        isActive: true,
        search: productSearchQuery || undefined,
      }),
    enabled: isEditingItems,
  });

  const { data: menusData } = useQuery({
    queryKey: ["menus-active"],
    queryFn: () => fetchMenus({ isActive: true, limit: 50 }),
    enabled: isEditingItems,
  });

  // Item editing helpers
  const getItemKey = (item: EditOrderItem) =>
    item.menuId ? `menu-${item.menuId}` : item.productId;

  const addProductToOrder = (product: Product) => {
    const unitType = product.unitType || "piece";
    const increment = UNIT_CONFIG[unitType].defaultQty;
    const existing = editableItems.find(
      (item) => item.productId === product.id && !item.menuId,
    );
    if (existing) {
      setEditableItems(
        editableItems.map((item) =>
          item.productId === product.id && !item.menuId
            ? { ...item, quantity: roundQty(item.quantity + increment, item.unit) }
            : item,
        ),
      );
    } else {
      setEditableItems([
        ...editableItems,
        {
          productId: product.id,
          productName: product.name,
          quantity: increment,
          unitPrice: product.price,
          unit: unitType,
        },
      ]);
    }
  };

  const addMenuToOrder = (menu: {
    id: string;
    name: string;
    price: string | null;
  }) => {
    const existing = editableItems.find((item) => item.menuId === menu.id);
    const menuPrice = menu.price || "0";
    if (existing) {
      setEditableItems(
        editableItems.map((item) =>
          item.menuId === menu.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setEditableItems([
        ...editableItems,
        {
          productId: menu.id,
          productName: menu.name,
          quantity: 1,
          unitPrice: menuPrice,
          menuId: menu.id,
          unit: "piece",
        },
      ]);
    }
  };

  const updateItemQuantity = (key: string, delta: number) => {
    setEditableItems(
      editableItems
        .map((item) => {
          if (getItemKey(item) !== key) return item;
          const step = UNIT_CONFIG[item.unit].step * Math.sign(delta);
          const newQty = roundQty(item.quantity + step, item.unit);
          return { ...item, quantity: Math.max(0, newQty) };
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const setItemQuantity = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setEditableItems(editableItems.filter((item) => getItemKey(item) !== key));
    } else {
      setEditableItems(
        editableItems.map((item) =>
          getItemKey(item) === key ? { ...item, quantity } : item,
        ),
      );
    }
  };

  const removeItem = (key: string) => {
    setEditableItems(
      editableItems.filter((item) => getItemKey(item) !== key),
    );
  };

  const updateItemPrice = (key: string, price: string) => {
    setEditableItems(
      editableItems.map((item) =>
        getItemKey(item) === key ? { ...item, unitPrice: price } : item,
      ),
    );
  };

  const updateItemNotes = (key: string, notes: string) => {
    setEditableItems(
      editableItems.map((item) =>
        getItemKey(item) === key ? { ...item, notes } : item,
      ),
    );
  };

  const calculateEditSubtotal = () => {
    return editableItems.reduce(
      (total, item) => total + lineTotal(item.quantity, item.unitPrice),
      0,
    );
  };

  const calculateEditDiscount = () => {
    const subtotal = calculateEditSubtotal();
    const val = parseFloat(editDiscountValue);
    if (!editDiscountValue || isNaN(val) || val <= 0) return 0;
    const amount = editDiscountType === "percentage" ? (subtotal * val) / 100 : val;
    return Math.min(amount, subtotal);
  };

  const calculateEditTotal = () => {
    return calculateEditSubtotal() - calculateEditDiscount();
  };

  const enterItemEditMode = () => {
    if (!order) return;
    const productsList = productsData?.data ?? [];
    // Convert server-expanded items back to collapsed editable form
    const collapsed: EditOrderItem[] = [];
    const menuGroups = new Map<string, EditOrderItem>();

    for (const item of order.items) {
      const qty = parseQty(item.quantity);
      const product = productsList.find((p: any) => p.id === item.productId);
      const unitType = product?.unitType ?? (item as any).unit ?? "piece";
      if (item.isMenu) {
        // Group menu items by productId (which is the menuId)
        const existing = menuGroups.get(item.productId);
        if (existing) {
          existing.quantity += qty;
        } else {
          menuGroups.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            quantity: qty,
            unitPrice: item.unitPrice,
            notes: item.notes ?? undefined,
            menuId: item.productId,
            unit: unitType,
          });
        }
      } else {
        collapsed.push({
          productId: item.productId,
          productName: item.productName,
          quantity: qty,
          unitPrice: item.unitPrice,
          notes: item.notes ?? undefined,
          unit: unitType,
        });
      }
    }

    collapsed.push(...menuGroups.values());
    setEditableItems(collapsed);
    if ((order as any).discountType) {
      setEditDiscountType((order as any).discountType);
      setEditDiscountValue((order as any).discountValue || "");
    } else {
      setEditDiscountType("percentage");
      setEditDiscountValue("");
    }
    setIsEditingItems(true);
    setProductSearchQuery("");
  };

  const cancelItemEdit = () => {
    setIsEditingItems(false);
    setEditableItems([]);
    setProductSearchQuery("");
  };

  const canEditItems =
    order &&
    !["ready", "picked_up"].includes(order.preparationStatus);

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
      setIsEditingItems(false);
      setEditableItems([]);
      setProductSearchQuery("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrder(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    const payload: UpdateOrder = { ...data };
    if (isEditingItems) {
      payload.items = editableItems;
      payload.discountType = editDiscountValue && parseFloat(editDiscountValue) > 0 ? editDiscountType : null;
      payload.discountValue = editDiscountValue && parseFloat(editDiscountValue) > 0 ? editDiscountValue : null;
    }
    updateOrderMutation.mutate(payload);
  });

  const isModified = isDirty || isEditingItems;

  const handleReset = () => {
    if (!order) return;
    form.reset(orderToFormValues(order));
    setSelectedClient(order.client ?? null);
    setClientSearchQuery("");
    setShowNewClientForm(false);
    clientForm.reset();
    cancelItemEdit();
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
            {isModified ? (
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
                  disabled={
                    updateOrderMutation.isPending ||
                    (isEditingItems && editableItems.length === 0)
                  }
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
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Articles (
                      {isEditingItems
                        ? editableItems.length
                        : order.items?.length || 0}
                      )
                    </CardTitle>
                    {!isEditingItems && (
                      <div className="flex items-center gap-2">
                        {canEditItems && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={enterItemEditMode}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Modifier
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            if (order.preparationStatus === "pending") {
                              updateStatusMutation.mutate(
                                { preparationStatus: "in_preparation" },
                                { onSuccess: () => router.push(`/preparation/${order.id}`) },
                              );
                            } else {
                              router.push(`/preparation/${order.id}`);
                            }
                          }}
                          disabled={updateStatusMutation.isPending}
                        >
                          <ChefHat className="mr-2 h-4 w-4" />
                          {order.preparationStatus === "pending" ? "Lancer la préparation" : "Voir la préparation"}
                        </Button>
                      </div>
                    )}
                    {isEditingItems && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelItemEdit}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Annuler
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isEditingItems ? (
                    <div className="space-y-4">
                      <Tabs defaultValue={editableItems.some((i) => !!i.menuId) && !editableItems.some((i) => !i.menuId) ? "menus" : "produits"}>
                        <TabsList className="w-full">
                          <TabsTrigger value="produits" className="flex-1">
                            Produits
                            {(() => {
                              const count = editableItems.filter((i) => !i.menuId).length;
                              return count > 0 ? (
                                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                                  {count}
                                </span>
                              ) : null;
                            })()}
                          </TabsTrigger>
                          <TabsTrigger value="menus" className="flex-1">
                            Menus
                            {(() => {
                              const count = editableItems.filter((i) => !!i.menuId).length;
                              return count > 0 ? (
                                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                                  {count}
                                </span>
                              ) : null;
                            })()}
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="produits" className="mt-3 space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Rechercher un produit..."
                              value={productSearchQuery}
                              onChange={(e) =>
                                setProductSearchQuery(e.target.value)
                              }
                              className="pl-10"
                            />
                            {productSearchQuery && (
                              <Button
                                variant="ghost"
                                size="icon"
                                type="button"
                                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                onClick={() => setProductSearchQuery("")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {productsData?.data && productsData.data.length > 0 ? (
                            <div className="grid gap-2 sm:grid-cols-2 max-h-[300px] overflow-y-auto">
                              {productsData.data.map((product) => {
                                const inCart = editableItems.find(
                                  (item) =>
                                    item.productId === product.id &&
                                    !item.menuId,
                                );
                                const cartQty = inCart?.quantity ?? 0;
                                const remaining =
                                  product.stock !== null
                                    ? parseQty(product.stock) - cartQty
                                    : null;
                                const isOutOfStock =
                                  remaining !== null &&
                                  remaining <= 0 &&
                                  !inCart;
                                return (
                                  <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => addProductToOrder(product)}
                                    disabled={isOutOfStock}
                                    className={cn(
                                      "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                                      inCart && "border-primary bg-primary/5",
                                      isOutOfStock &&
                                        "opacity-50 cursor-not-allowed hover:bg-transparent",
                                    )}
                                  >
                                    {product.imageUrl && (
                                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-muted">
                                        <Image
                                          src={product.imageUrl}
                                          alt={product.name}
                                          fill
                                          className="object-cover"
                                          sizes="40px"
                                        />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">
                                        {product.name}
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>
                                          {formatCurrency(product.price)}{product.unitType !== "piece" ? UNIT_CONFIG[product.unitType].priceSuffix : ""}
                                        </span>
                                        {product.stock !== null && (
                                          <span
                                            className={cn(
                                              "text-xs",
                                              remaining !== null &&
                                                remaining <= 0 &&
                                                "text-destructive font-medium",
                                              remaining !== null &&
                                                remaining > 0 &&
                                                remaining <= 3 &&
                                                "text-amber-600 font-medium",
                                            )}
                                          >
                                            {remaining !== null &&
                                            remaining <= 0
                                              ? "Rupture"
                                              : `Stock: ${remaining}${UNIT_CONFIG[product.unitType].suffix ? ` ${UNIT_CONFIG[product.unitType].suffix}` : ""}`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {inCart && (
                                      <Badge
                                        variant="default"
                                        className="ml-2 shrink-0"
                                      >
                                        {formatQtyLabel(inCart.quantity, inCart.unit)}
                                      </Badge>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              Aucun produit trouv&eacute;
                            </div>
                          )}
                        </TabsContent>

                        <TabsContent value="menus" className="mt-3">
                          {menusData?.data && menusData.data.length > 0 ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {menusData.data.map((menu) => {
                                const inCart = editableItems.find(
                                  (item) => item.menuId === menu.id,
                                );
                                return (
                                  <button
                                    key={menu.id}
                                    type="button"
                                    onClick={() => addMenuToOrder(menu)}
                                    className={cn(
                                      "flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                                      inCart && "border-primary bg-primary/5",
                                    )}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate flex items-center gap-2">
                                        {menu.name}
                                        <Badge
                                          variant="outline"
                                          className="text-xs shrink-0"
                                        >
                                          Menu
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        {menu.price
                                          ? formatCurrency(menu.price)
                                          : "Prix variable"}
                                      </div>
                                    </div>
                                    {inCart && (
                                      <Badge
                                        variant="default"
                                        className="ml-2 shrink-0"
                                      >
                                        {inCart.quantity}
                                      </Badge>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                              Aucun menu disponible
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>

                      {/* Editable cart */}
                      {editableItems.length > 0 && (
                        <div className="space-y-3">
                          <Separator />
                          <div className="text-sm font-medium flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3 -mx-1">
                            <ShoppingCart className="h-4 w-4 text-blue-600" />
                            <span>Panier</span>
                            <Badge variant="secondary" className="ml-auto bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              {editableItems.length}
                            </Badge>
                          </div>
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {editableItems.map((item) => {
                              const key = getItemKey(item);
                              return (
                                <div
                                  key={key}
                                  className="rounded-lg border bg-muted/30 p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium truncate flex-1 min-w-0 flex items-center gap-2">
                                      {item.productName}
                                      {item.menuId && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs shrink-0"
                                        >
                                          Menu
                                        </Badge>
                                      )}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                                      onClick={() => removeItem(key)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() =>
                                          updateItemQuantity(key, -1)
                                        }
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <div className="flex items-center gap-1.5">
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          defaultValue={item.quantity}
                                          key={`${key}-${item.quantity}`}
                                          onBlur={(e) => {
                                            const val = parseFloat(e.target.value.replace(",", "."));
                                            if (!isNaN(val) && val > 0) {
                                              const rounded = roundQty(val, item.unit);
                                              setItemQuantity(key, rounded);
                                            } else {
                                              e.target.value = String(item.quantity);
                                            }
                                          }}
                                          className={`h-9 text-center font-semibold text-base px-1 ${item.unit === "kg" ? "w-20" : "w-14"}`}
                                        />
                                        <span className="text-sm font-semibold text-muted-foreground">
                                          {UNIT_CONFIG[item.unit].suffix || "x"}
                                        </span>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="h-9 w-9"
                                        onClick={() =>
                                          updateItemQuantity(key, 1)
                                        }
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                    <div className="text-right font-medium text-sm">
                                      {formatCurrency(
                                        lineTotal(item.quantity, item.unitPrice),
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        defaultValue={parseFloat(item.unitPrice).toFixed(2)}
                                        key={`price-${key}-${item.unitPrice}`}
                                        onBlur={(e) => {
                                          const val = parseFloat(e.target.value.replace(",", "."));
                                          if (!isNaN(val) && val >= 0) {
                                            updateItemPrice(key, val.toFixed(2));
                                          } else {
                                            e.target.value = parseFloat(item.unitPrice).toFixed(2);
                                          }
                                        }}
                                        className="h-5 w-14 text-center text-xs px-1 bg-white dark:bg-background"
                                      />
                                      <span>€{UNIT_CONFIG[item.unit].priceSuffix}</span>
                                    </div>
                                    <Input
                                      placeholder="Notes..."
                                      value={item.notes || ""}
                                      onChange={(e) =>
                                        updateItemNotes(key, e.target.value)
                                      }
                                      className="h-5 text-xs flex-1 max-w-[60%]"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <Separator />

                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">
                                Sous-total
                              </span>
                              <span>
                                {formatCurrency(calculateEditSubtotal())}
                              </span>
                            </div>

                            {/* Discount input */}
                            <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                              <span className="text-sm text-muted-foreground shrink-0">Remise</span>
                              <div className="flex items-center gap-1 flex-1">
                                <div className="flex rounded-md border overflow-hidden h-7">
                                  <button
                                    type="button"
                                    onClick={() => setEditDiscountType("percentage")}
                                    className={`px-2 text-xs font-medium transition-colors ${editDiscountType === "percentage" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-background hover:bg-muted"}`}
                                  >
                                    %
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditDiscountType("fixed")}
                                    className={`px-2 text-xs font-medium transition-colors ${editDiscountType === "fixed" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-background hover:bg-muted"}`}
                                  >
                                    €
                                  </button>
                                </div>
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={editDiscountValue}
                                  onChange={(e) => setEditDiscountValue(e.target.value.replace(",", "."))}
                                  className="h-7 w-20 text-center text-sm bg-white dark:bg-background"
                                />
                              </div>
                              {calculateEditDiscount() > 0 && (
                                <span className="text-sm text-destructive font-semibold">
                                  -{formatCurrency(calculateEditDiscount())}
                                </span>
                              )}
                            </div>

                            <div className="flex justify-between items-center font-semibold text-lg rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3 -mx-1">
                              <span>Total</span>
                              <span className="text-blue-700 dark:text-blue-400">
                                {formatCurrency(calculateEditTotal())}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {editableItems.length === 0 && (
                        <div className="py-8 text-center text-muted-foreground">
                          <ShoppingCart className="mx-auto h-12 w-12 opacity-20" />
                          <p className="mt-2">Aucun article</p>
                          <p className="text-sm">
                            Cliquez sur un produit ou menu pour l&apos;ajouter
                          </p>
                        </div>
                      )}
                    </div>
                  ) : order.items && order.items.length > 0 ? (
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {item.productName}
                              </span>
                              {item.isMenu && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Menu
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{formatCurrency(item.unitPrice)}{UNIT_CONFIG[item.unit ?? "piece"].priceSuffix}</span>
                              {item.notes && (
                                <span className="italic truncate">- {item.notes}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-semibold text-base">
                              {formatQtyLabel(item.quantity, item.unit)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(item.totalPrice)}
                            </div>
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
                        {Number.parseFloat((order as any).discountAmount || "0") > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Remise
                              {(order as any).discountType === "percentage" && (
                                <span className="ml-1">({(order as any).discountValue}%)</span>
                              )}
                            </span>
                            <span className="text-destructive">
                              -{formatCurrency((order as any).discountAmount)}
                            </span>
                          </div>
                        )}
                        {Number.parseFloat(order.taxTotal) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">
                              Taxes
                            </span>
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
                  {!showNewClientForm ? (
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

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setShowNewClientForm(true)}
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Nouveau client
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Nouveau client</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowNewClientForm(false);
                            clientForm.reset();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">Nom *</label>
                          <Input
                            placeholder="Nom du client"
                            {...clientForm.register("name")}
                          />
                          {clientForm.formState.errors.name && (
                            <p className="text-xs text-destructive mt-1">
                              {clientForm.formState.errors.name.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-sm font-medium">
                            Téléphone
                          </label>
                          <Input
                            placeholder="06 12 34 56 78"
                            {...clientForm.register("phone")}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Email</label>
                          <Input
                            type="email"
                            placeholder="client@example.com"
                            {...clientForm.register("email")}
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShowNewClientForm(false);
                            clientForm.reset();
                          }}
                        >
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          className="flex-1"
                          disabled={createClientMutation.isPending}
                          onClick={handleQuickClientCreate}
                        >
                          {createClientMutation.isPending ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="mr-2 h-4 w-4" />
                          )}
                          Créer
                        </Button>
                      </div>

                      {createClientMutation.isError && (
                        <p className="text-sm text-destructive">
                          Erreur:{" "}
                          {(createClientMutation.error as Error).message}
                        </p>
                      )}
                    </div>
                  )}
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
                  <FormField
                    control={form.control}
                    name="createdById"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prise par</FormLabel>
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
                      </FormItem>
                    )}
                  />
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la commande</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la commande #{order.ticketNumber} ?
              Cette action est irréversible et le stock sera restauré.
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
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
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
