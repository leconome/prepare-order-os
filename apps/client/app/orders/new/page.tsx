"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { UNIT_CONFIG, formatQtyLabel, formatWeightLabel, parseQty, roundQty, type Unit, createClientSchema, createOrderSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarIcon,
  Check,
  Coffee,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Sun,
  Sunset,
  Trash2,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type Client,
  type CreateClient,
  type CreateOrder,
  type Product,
  createClient,
  createOrder,
  fetchClients,
  fetchMenus,
  fetchPointsOfSale,
  fetchStaff,
  fetchProducts,
  formatCurrency,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type OrderItem = {
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

export default function NewOrderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedInterval, setSelectedInterval] = useState<string | null>(null);

  // Client selection state
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", searchQuery],
    queryFn: () =>
      fetchProducts({ limit: 50, isActive: true, search: searchQuery || undefined }),
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff({ limit: 100, isActive: true }),
  });

  const { data: menusData } = useQuery({
    queryKey: ["menus-active"],
    queryFn: () => fetchMenus({ isActive: true, limit: 50 }),
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients", clientSearchQuery],
    queryFn: () => fetchClients({ limit: 20, search: clientSearchQuery || undefined }),
  });

  const { data: posData } = useQuery({
    queryKey: ["points-of-sale-active"],
    queryFn: () => fetchPointsOfSale({ isActive: true, limit: 100 }),
  });
  const pointsOfSale = posData?.data ?? [];

  // Quick client creation form
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
      setShowNewClientForm(false);
      clientForm.reset();
    },
  });

  const form = useForm({
    resolver: zodResolver(
      createOrderSchema.omit({ items: true }).extend({
        pickupDate: createOrderSchema.shape.pickupDate,
        pickupTimeStart: createOrderSchema.shape.pickupTimeStart,
        pickupTimeEnd: createOrderSchema.shape.pickupTimeEnd,
        clientNote: createOrderSchema.shape.clientNote,
        internalNote: createOrderSchema.shape.internalNote,
        createdById: createOrderSchema.shape.createdById,
        assignedToId: createOrderSchema.shape.assignedToId,
      })
    ),
    defaultValues: {
      pickupDate: undefined,
      pickupTimeStart: "",
      pickupTimeEnd: "",
      clientNote: "",
      internalNote: "",
      createdById: "",
      assignedToId: "",
      posId: undefined,
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: CreateOrder) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
  });

  const handleIntervalSelect = (interval: TimeInterval) => {
    if (selectedInterval === interval.id) {
      // Deselect
      setSelectedInterval(null);
      form.setValue("pickupTimeStart", "");
      form.setValue("pickupTimeEnd", "");
    } else {
      // Select
      setSelectedInterval(interval.id);
      form.setValue("pickupTimeStart", interval.timeStart);
      form.setValue("pickupTimeEnd", interval.timeEnd);
    }
  };

  const addProductToOrder = (product: Product) => {
    const unitType = product.unitType || "piece";
    const increment = product.defaultQty ? parseQty(product.defaultQty) : UNIT_CONFIG[unitType].defaultQty;
    const existingItem = orderItems.find(
      (item) => item.productId === product.id && !item.menuId
    );
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.productId === product.id && !item.menuId
            ? { ...item, quantity: roundQty(item.quantity + increment, item.unit) }
            : item
        )
      );
    } else {
      setOrderItems([
        ...orderItems,
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

  const addMenuToOrder = (menu: { id: string; name: string; price: string | null }) => {
    const existingItem = orderItems.find((item) => item.menuId === menu.id);
    // Calculate menu price: use explicit price or "0" (backend resolves from products)
    const menuPrice = menu.price || "0";
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.menuId === menu.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          productId: menu.id,
          productName: menu.name,
          quantity: 1,
          unitPrice: menuPrice,
          menuId: menu.id,
          unit: "piece" as const,
        },
      ]);
    }
  };

  const getItemKey = (item: OrderItem) => item.menuId ? `menu-${item.menuId}` : item.productId;

  const updateItemQuantity = (key: string, delta: number) => {
    setOrderItems(
      orderItems
        .map((item) => {
          if (getItemKey(item) !== key) return item;
          const step = UNIT_CONFIG[item.unit].step * Math.sign(delta);
          const newQty = Math.round((item.quantity + step) * 100) / 100;
          return { ...item, quantity: Math.max(0, newQty) };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const setItemQuantity = (key: string, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter((item) => getItemKey(item) !== key));
    } else {
      setOrderItems(
        orderItems.map((item) =>
          getItemKey(item) === key ? { ...item, quantity } : item
        )
      );
    }
  };

  const removeItem = (key: string) => {
    setOrderItems(orderItems.filter((item) => getItemKey(item) !== key));
  };

  const updateItemPrice = (key: string, price: string) => {
    setOrderItems(
      orderItems.map((item) =>
        getItemKey(item) === key ? { ...item, unitPrice: price } : item
      )
    );
  };

  const updateItemNotes = (key: string, notes: string) => {
    setOrderItems(
      orderItems.map((item) =>
        getItemKey(item) === key ? { ...item, notes } : item
      )
    );
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((total, item) => {
      return total + parseFloat(item.unitPrice) * item.quantity;
    }, 0);
  };

  const calculateDiscount = () => {
    const subtotal = calculateSubtotal();
    const val = parseFloat(discountValue);
    if (!discountValue || isNaN(val) || val <= 0) return 0;
    const amount = discountType === "percentage" ? (subtotal * val) / 100 : val;
    return Math.min(amount, subtotal);
  };

  const calculateTotal = () => {
    return calculateSubtotal() - calculateDiscount();
  };

  const onSubmit = form.handleSubmit((data) => {
    if (orderItems.length === 0) {
      return;
    }

    const orderData: CreateOrder = {
      items: orderItems,
      clientId: selectedClient?.id || undefined,
      pickupDate: data.pickupDate,
      pickupTimeStart: data.pickupTimeStart || undefined,
      pickupTimeEnd: data.pickupTimeEnd || undefined,
      clientNote: data.clientNote || undefined,
      internalNote: data.internalNote || undefined,
      createdById: data.createdById || undefined,
      assignedToId: data.assignedToId || undefined,
      posId: data.posId || undefined,
      discountType: discountValue && parseFloat(discountValue) > 0 ? discountType : null,
      discountValue: discountValue && parseFloat(discountValue) > 0 ? discountValue : undefined,
    };

    createOrderMutation.mutate(orderData);
  });

  const handleQuickClientCreate = clientForm.handleSubmit((data) => {
    createClientMutation.mutate(data as CreateClient);
  });

  return (
    <DashboardLayout
      title="Nouvelle commande"
      description="Créez une nouvelle commande client"
    >
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux commandes
          </Link>
        </Button>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Product & Menu Selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Menu Selection */}
            {menusData?.data && menusData.data.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Menus</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {menusData.data.map((menu) => {
                      const inCart = orderItems.find((item) => item.menuId === menu.id);
                      return (
                        <button
                          key={menu.id}
                          type="button"
                          onClick={() => addMenuToOrder(menu)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                            inCart && "border-primary bg-primary/5"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate flex items-center gap-2">
                              {menu.name}
                              <Badge variant="outline" className="text-xs shrink-0">
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
                            <Badge variant="default" className="ml-2 shrink-0">
                              {inCart.quantity}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Product Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Produits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un produit..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                    {searchQuery && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {productsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : productsData?.data.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground">
                      Aucun produit trouvé
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {productsData?.data.map((product) => {
                        const inCart = orderItems.find(
                          (item) => item.productId === product.id && !item.menuId
                        );
                        const cartQty = inCart?.quantity ?? 0;
                        const hasStock = product.stock !== null;
                        const remaining = hasStock ? parseQty(product.stock!) - cartQty : null;
                        const isOutOfStock = remaining !== null && remaining <= 0 && !inCart;
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addProductToOrder(product)}
                            disabled={isOutOfStock}
                            className={cn(
                              "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                              inCart && "border-primary bg-primary/5",
                              isOutOfStock && "opacity-50 cursor-not-allowed hover:bg-transparent"
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
                                <span>{formatCurrency(product.price)}{product.unitType !== "piece" ? UNIT_CONFIG[product.unitType].priceSuffix : ""}</span>
                                {hasStock && (
                                  <span className={cn(
                                    "text-xs",
                                    remaining !== null && remaining <= 0 && "text-destructive font-medium",
                                    remaining !== null && remaining > 0 && remaining <= 3 && "text-amber-600 font-medium",
                                  )}>
                                    {remaining !== null && remaining <= 0
                                      ? "Rupture"
                                      : `Stock: ${remaining}${UNIT_CONFIG[product.unitType].suffix ? ` ${UNIT_CONFIG[product.unitType].suffix}` : ""}`}
                                  </span>
                                )}
                              </div>
                            </div>
                            {inCart && (
                              <Badge variant="default" className="ml-2 shrink-0">
                                {formatQtyLabel(inCart.quantity, inCart.unit)}
                              </Badge>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>

          {/* Right column: Cart, Client, Order Details */}
          <div className="space-y-4">
            <Card className="border-blue-200/50 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-t-lg">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  Panier
                  {orderItems.length > 0 && (
                    <Badge className="ml-auto bg-blue-600 text-white">
                      {orderItems.length}{" "}
                      article{orderItems.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {orderItems.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <ShoppingCart className="mx-auto h-12 w-12 opacity-20" />
                    <p className="mt-2">Aucun produit sélectionné</p>
                    <p className="text-sm">
                      Cliquez sur un produit pour l'ajouter
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {orderItems.map((item) => {
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
                                  <Badge variant="outline" className="text-xs shrink-0">
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
                                  onClick={() => updateItemQuantity(key, -1)}
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
                                  onClick={() => updateItemQuantity(key, 1)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="text-right font-medium text-sm">
                                {formatCurrency(
                                  parseFloat(item.unitPrice) * item.quantity
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
                                placeholder={item.menuId ? "Notes..." : "Notes..."}
                                value={item.notes || ""}
                                onChange={(e) => updateItemNotes(key, e.target.value)}
                                className="h-5 text-xs flex-1 max-w-[60%]"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sous-total</span>
                        <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
                      </div>

                      {/* Discount input */}
                      <div className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                        <span className="text-sm text-muted-foreground shrink-0">Remise</span>
                        <div className="flex items-center gap-1 flex-1">
                          <div className="flex rounded-md border overflow-hidden h-7">
                            <button
                              type="button"
                              onClick={() => setDiscountType("percentage")}
                              className={`px-2 text-xs font-medium transition-colors ${discountType === "percentage" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-background hover:bg-muted"}`}
                            >
                              %
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiscountType("fixed")}
                              className={`px-2 text-xs font-medium transition-colors ${discountType === "fixed" ? "bg-primary text-primary-foreground" : "bg-white dark:bg-background hover:bg-muted"}`}
                            >
                              €
                            </button>
                          </div>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value.replace(",", "."))}
                            className="h-7 w-20 text-center text-sm bg-white dark:bg-background"
                          />
                        </div>
                        {calculateDiscount() > 0 && (
                          <span className="text-sm text-destructive font-semibold">
                            -{formatCurrency(calculateDiscount())}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center font-semibold text-lg rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-3 -mx-1">
                        <span>Total</span>
                        <span className="text-blue-700 dark:text-blue-400">{formatCurrency(calculateTotal())}</span>
                      </div>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>

            {/* Client Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRound className="h-4 w-4" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!showNewClientForm ? (
                  <div className="space-y-3">
                    {selectedClient && (
                      <div className="flex items-center justify-between rounded-lg border border-primary bg-primary/5 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs text-white shrink-0">
                            {selectedClient.name[0]?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{selectedClient.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {selectedClient.phone || selectedClient.email || "Aucun contact"}
                            </div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setSelectedClient(null)}
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
                            onChange={(e) => setClientSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>

                        {clientsData?.data && clientsData.data.length > 0 && (
                          <div className="max-h-[150px] overflow-y-auto space-y-1 rounded-lg border p-2">
                            {clientsData.data.map((client) => (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => {
                                  setSelectedClient(client);
                                  setClientSearchQuery("");
                                }}
                                className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted transition-colors"
                              >
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs">
                                  {client.name[0]?.toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate">{client.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {client.phone || client.email || "Aucun contact"}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {clientSearchQuery && clientsData?.data?.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Aucun client trouvé
                          </p>
                        )}
                      </>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowNewClientForm(true)}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Nouveau client
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Nouveau client</h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          setShowNewClientForm(false);
                          clientForm.reset();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-medium">Nom *</label>
                        <Input
                          placeholder="Nom du client"
                          className="h-8"
                          {...clientForm.register("name")}
                        />
                        {clientForm.formState.errors.name && (
                          <p className="text-xs text-destructive mt-1">
                            {clientForm.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium">Téléphone</label>
                        <Input
                          placeholder="06 12 34 56 78"
                          className="h-8"
                          {...clientForm.register("phone")}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium">Email</label>
                        <Input
                          type="email"
                          placeholder="client@example.com"
                          className="h-8"
                          {...clientForm.register("email")}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
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
                        size="sm"
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
                        Erreur: {(createClientMutation.error as Error).message}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Détails</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-3">
                    <FormField
                      control={form.control}
                      name="pickupDate"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="text-xs">Date de retrait</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "EEE d MMM yyyy", { locale: fr })
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
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                  date < new Date(new Date().setHours(0, 0, 0, 0))
                                }
                                initialFocus
                                locale={fr}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-1">
                      <FormLabel className="text-xs">Créneau de retrait</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {TIME_INTERVALS.map((interval) => (
                          <button
                            key={interval.id}
                            type="button"
                            onClick={() => handleIntervalSelect(interval)}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all text-xs",
                              selectedInterval === interval.id
                                ? "border-transparent bg-gradient-to-br text-white shadow-md " + interval.color
                                : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full",
                              selectedInterval === interval.id
                                ? "bg-white/20"
                                : "bg-gradient-to-br " + interval.color + " text-white"
                            )}>
                              {interval.icon}
                            </div>
                            <div className="font-semibold">{interval.label}</div>
                            <div className={cn(
                              "text-[10px]",
                              selectedInterval === interval.id
                                ? "text-white/80"
                                : "text-muted-foreground"
                            )}>
                              {interval.timeStart}-{interval.timeEnd}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="posId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Point de vente</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                            value={field.value ?? "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Aucun" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Aucun</SelectItem>
                              {pointsOfSale.filter((p) => p.type === "permanent_pos").length > 0 && (
                                <SelectGroup>
                                  <SelectSeparator />
                                  <SelectLabel>Points de vente</SelectLabel>
                                  {pointsOfSale.filter((p) => p.type === "permanent_pos").map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                              {pointsOfSale.filter((p) => p.type === "pickup_location").length > 0 && (
                                <SelectGroup>
                                  <SelectSeparator />
                                  <SelectLabel>Points de retrait</SelectLabel>
                                  {pointsOfSale.filter((p) => p.type === "pickup_location").map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                  ))}
                                </SelectGroup>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <FormField
                        control={form.control}
                        name="createdById"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Prise par</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {staffData?.data.map((user) => (
                                  <SelectItem
                                    key={user.id}
                                    value={user.id}
                                  >
                                    {user.name || user.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="assignedToId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Assigné à</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Choisir..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {staffData?.data.map((user) => (
                                  <SelectItem
                                    key={user.id}
                                    value={user.id}
                                  >
                                    {user.name || user.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="clientNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Note client</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Instructions du client..."
                              className="min-h-[60px] text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="internalNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Note interne</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Notes internes..."
                              className="min-h-[60px] text-sm"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              onClick={onSubmit}
              disabled={
                orderItems.length === 0 || createOrderMutation.isPending
              }
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              size="lg"
            >
              {createOrderMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="mr-2 h-4 w-4" />
              )}
              Créer la commande
            </Button>

            {createOrderMutation.isError && (
              <p className="text-sm text-destructive text-center">
                Erreur: {(createOrderMutation.error as Error).message}
              </p>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
