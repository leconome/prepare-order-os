"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createOrderSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarIcon,
  Coffee,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Sun,
  Sunset,
  Trash2,
  X,
} from "lucide-react";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type CreateOrder,
  type Product,
  createOrder,
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

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["products", searchQuery],
    queryFn: () =>
      fetchProducts({ limit: 50, isActive: true, search: searchQuery || undefined }),
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff({ limit: 100, isActive: true }),
  });

  const form = useForm({
    resolver: zodResolver(
      createOrderSchema.omit({ items: true, createdById: true }).extend({
        pickupDate: createOrderSchema.shape.pickupDate,
        pickupTimeStart: createOrderSchema.shape.pickupTimeStart,
        pickupTimeEnd: createOrderSchema.shape.pickupTimeEnd,
        clientNote: createOrderSchema.shape.clientNote,
        internalNote: createOrderSchema.shape.internalNote,
        assignedToId: createOrderSchema.shape.assignedToId,
      })
    ),
    defaultValues: {
      pickupDate: undefined,
      pickupTimeStart: "",
      pickupTimeEnd: "",
      clientNote: "",
      internalNote: "",
      assignedToId: "",
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
    const existingItem = orderItems.find(
      (item) => item.productId === product.id
    );
    if (existingItem) {
      setOrderItems(
        orderItems.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setOrderItems([
        ...orderItems,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
        },
      ]);
    }
  };

  const updateItemQuantity = (productId: string, delta: number) => {
    setOrderItems(
      orderItems
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setOrderItems(orderItems.filter((item) => item.productId !== productId));
  };

  const updateItemNotes = (productId: string, notes: string) => {
    setOrderItems(
      orderItems.map((item) =>
        item.productId === productId ? { ...item, notes } : item
      )
    );
  };

  const calculateTotal = () => {
    return orderItems.reduce((total, item) => {
      return total + parseFloat(item.unitPrice) * item.quantity;
    }, 0);
  };

  const onSubmit = form.handleSubmit((data) => {
    if (orderItems.length === 0) {
      return;
    }

    const orderData: CreateOrder = {
      items: orderItems,
      pickupDate: data.pickupDate || undefined,
      pickupTimeStart: data.pickupTimeStart || undefined,
      pickupTimeEnd: data.pickupTimeEnd || undefined,
      clientNote: data.clientNote || undefined,
      internalNote: data.internalNote || undefined,
      assignedToId: data.assignedToId || undefined,
    };

    createOrderMutation.mutate(orderData);
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
          {/* Product Selection */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Sélectionner des produits
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
                          (item) => item.productId === product.id
                        );
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addProductToOrder(product)}
                            className={cn(
                              "flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                              inCart && "border-primary bg-primary/5"
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {product.name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(product.price)}
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
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Order Details Form */}
            <Card>
              <CardHeader>
                <CardTitle>Détails de la commande</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form className="space-y-4">
                    {/* Date picker */}
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
                                    !field.value && "text-muted-foreground"
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "EEEE d MMMM yyyy", { locale: fr })
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

                    {/* Time intervals */}
                    <div className="space-y-2">
                      <FormLabel>Créneau de retrait</FormLabel>
                      <div className="grid grid-cols-3 gap-3">
                        {TIME_INTERVALS.map((interval) => (
                          <button
                            key={interval.id}
                            type="button"
                            onClick={() => handleIntervalSelect(interval)}
                            className={cn(
                              "relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all hover:scale-[1.02]",
                              selectedInterval === interval.id
                                ? "border-transparent bg-gradient-to-br text-white shadow-lg " + interval.color
                                : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/50"
                            )}
                          >
                            <div className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full",
                              selectedInterval === interval.id
                                ? "bg-white/20"
                                : "bg-gradient-to-br " + interval.color + " text-white"
                            )}>
                              {interval.icon}
                            </div>
                            <div className="text-center">
                              <div className="font-semibold">{interval.label}</div>
                              <div className={cn(
                                "text-xs",
                                selectedInterval === interval.id
                                  ? "text-white/80"
                                  : "text-muted-foreground"
                              )}>
                                {interval.timeStart} - {interval.timeEnd}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="assignedToId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigné à</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un membre" />
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
                      name="clientNote"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Note client</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Instructions du client..."
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
                          <FormLabel>Note interne</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Notes internes (non visibles par le client)..."
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
          </div>

          {/* Order Summary */}
          <div className="space-y-4">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Panier
                  {orderItems.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {orderItems.reduce((sum, item) => sum + item.quantity, 0)}{" "}
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
                      {orderItems.map((item) => (
                        <div
                          key={item.productId}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {item.productName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {formatCurrency(item.unitPrice)} x {item.quantity}
                              </div>
                            </div>
                            <div className="text-right font-medium">
                              {formatCurrency(
                                parseFloat(item.unitPrice) * item.quantity
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  updateItemQuantity(item.productId, -1)
                                }
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="w-8 text-center text-sm font-medium">
                                {item.quantity}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() =>
                                  updateItemQuantity(item.productId, 1)
                                }
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeItem(item.productId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Notes pour ce produit..."
                            value={item.notes || ""}
                            onChange={(e) =>
                              updateItemNotes(item.productId, e.target.value)
                            }
                            className="h-8 text-sm"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sous-total</span>
                        <span>{formatCurrency(calculateTotal())}</span>
                      </div>
                      <div className="flex justify-between font-medium text-lg">
                        <span>Total</span>
                        <span>{formatCurrency(calculateTotal())}</span>
                      </div>
                    </div>

                    <Button
                      onClick={onSubmit}
                      disabled={
                        orderItems.length === 0 || createOrderMutation.isPending
                      }
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
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
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
