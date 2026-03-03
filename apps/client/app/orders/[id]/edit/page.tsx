"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Minus,
  Plus,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Product,
  type UpdateOrder,
  fetchMenus,
  fetchOrder,
  fetchProducts,
  formatCurrency,
  updateOrder,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { UNIT_CONFIG, formatQtyLabel, roundQty, parseQty, type Unit } from "@prepareos/data";

type OrderItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  notes?: string;
  menuId?: string;
  unit: Unit;
};

export default function EditOrderItemsPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderId = params.id as string;

  const [searchQuery, setSearchQuery] = useState("");
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("");

  const { data: order, isLoading: orderLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    enabled: !!orderId,
  });

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", searchQuery],
    queryFn: () =>
      fetchProducts({ limit: 50, isActive: true, search: searchQuery || undefined }),
  });

  const { data: menusData } = useQuery({
    queryKey: ["menus-active"],
    queryFn: () => fetchMenus({ isActive: true, limit: 50 }),
  });

  // Pre-fill cart with existing order items
  useEffect(() => {
    if (!order || !productsData || initialized) return;
    const productsList = productsData?.data ?? [];
    const items: OrderItem[] = (order.items ?? []).map((item: any) => {
      const product = productsList.find((p: any) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: item.productName,
        quantity: parseQty(item.quantity),
        unitPrice: item.unitPrice,
        notes: item.notes ?? undefined,
        menuId: item.isMenu ? item.productId : undefined,
        unit: product?.unitType ?? (item as any).unit ?? "piece",
      };
    });
    // Merge duplicate menu items back into single entries with summed quantity
    const merged: OrderItem[] = [];
    for (const item of items) {
      const key = item.menuId ? `menu-${item.menuId}` : item.productId;
      const existing = merged.find(
        (m) => (m.menuId ? `menu-${m.menuId}` : m.productId) === key,
      );
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.push({ ...item });
      }
    }
    setOrderItems(merged);
    if ((order as any).discountType) {
      setDiscountType((order as any).discountType);
      setDiscountValue((order as any).discountValue || "");
    }
    setInitialized(true);
  }, [order, productsData, initialized]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateOrder) =>
      updateOrder(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/orders/${orderId}`);
    },
  });

  const addProductToOrder = (product: Product) => {
    const unitType = product.unitType || "piece";
    const increment = UNIT_CONFIG[unitType].defaultQty;
    const existingItem = orderItems.find(
      (item) => item.productId === product.id && !item.menuId,
    );
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.productId === product.id && !item.menuId
            ? { ...item, quantity: roundQty(item.quantity + increment, item.unit) }
            : item,
        ),
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
          unit: "piece" as const,
          menuId: menu.id,
        },
      ]);
    }
  };

  const getItemKey = (item: OrderItem) =>
    item.menuId ? `menu-${item.menuId}` : item.productId;

  const updateItemQuantity = (key: string, delta: number) => {
    setOrderItems(
      orderItems
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
      setOrderItems(orderItems.filter((item) => getItemKey(item) !== key));
    } else {
      setOrderItems(
        orderItems.map((item) =>
          getItemKey(item) === key ? { ...item, quantity } : item,
        ),
      );
    }
  };

  const removeItem = (key: string) => {
    setOrderItems(orderItems.filter((item) => getItemKey(item) !== key));
  };

  const updateItemPrice = (key: string, price: string) => {
    setOrderItems(
      orderItems.map((item) =>
        getItemKey(item) === key ? { ...item, unitPrice: price } : item,
      ),
    );
  };

  const updateItemNotes = (key: string, notes: string) => {
    setOrderItems(
      orderItems.map((item) =>
        getItemKey(item) === key ? { ...item, notes } : item,
      ),
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

  const handleSubmit = () => {
    if (orderItems.length === 0) return;
    updateMutation.mutate({
      items: orderItems,
      discountType: discountValue && parseFloat(discountValue) > 0 ? discountType : null,
      discountValue: discountValue && parseFloat(discountValue) > 0 ? discountValue : null,
    });
  };

  if (orderLoading) {
    return (
      <DashboardLayout title="Chargement..." description="">
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Skeleton className="h-96 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout title="Commande non trouvée" description="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cette commande n'existe pas.</p>
          <Button asChild className="mt-4">
            <Link href="/orders">Voir toutes les commandes</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={`Modifier #${order.ticketNumber}`}
      description="Modifier les articles de la commande"
    >
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/orders/${orderId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la commande
          </Link>
        </Button>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Product & Menu Selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Menu Selection */}
            {menusData?.data && menusData.data.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Menus
                    {(() => {
                      const count = orderItems.filter((i) => !!i.menuId).length;
                      return count > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                          {count}
                        </span>
                      ) : null;
                    })()}
                  </CardTitle>
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
                            inCart && "border-primary bg-primary/5",
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
                  {(() => {
                    const count = orderItems.filter((i) => !i.menuId).length;
                    return count > 0 ? (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                        {count}
                      </span>
                    ) : null;
                  })()}
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
                          (item) => item.productId === product.id && !item.menuId,
                        );
                        const cartQty = inCart?.quantity ?? 0;
                        const hasStock = product.stock !== null;
                        const remaining = hasStock ? parseQty(product.stock!) - cartQty : null;
                        const isOutOfStock =
                          remaining !== null && remaining <= 0 && !inCart;
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
                                <span>{formatCurrency(product.price)}{product.unitType !== "piece" ? UNIT_CONFIG[product.unitType].priceSuffix : ""}</span>
                                {hasStock && (
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

          {/* Cart Summary */}
          <div className="space-y-4">
            <Card className="sticky top-4 border-blue-200/50 shadow-sm">
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
                                  parseFloat(item.unitPrice) * item.quantity,
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

                    <Button
                      onClick={handleSubmit}
                      disabled={
                        orderItems.length === 0 || updateMutation.isPending
                      }
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Sauvegarder les modifications
                    </Button>

                    {updateMutation.isError && (
                      <p className="text-sm text-destructive text-center">
                        Erreur: {(updateMutation.error as Error).message}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
