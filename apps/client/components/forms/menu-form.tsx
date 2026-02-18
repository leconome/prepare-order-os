"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createMenuSchema, updateMenuSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type CreateMenu,
  type MenuWithProducts,
  type UpdateMenu,
  createMenu,
  deleteMenu,
  fetchProducts,
  formatCurrency,
  updateMenu,
} from "@/lib/api";

type SelectedProduct = {
  productId: string;
  productName: string;
  price: string;
  quantity: number;
};

interface MenuFormProps {
  initialData?: MenuWithProducts;
}

export function MenuForm({ initialData }: MenuFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(
    () => {
      if (initialData?.products) {
        return initialData.products.map((p) => ({
          productId: p.product.id,
          productName: p.product.name,
          price: p.product.price,
          quantity: p.quantity,
        }));
      }
      return [];
    },
  );

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(isEditMode ? updateMenuSchema : createMenuSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      price: initialData?.price ?? "",
      isActive: initialData?.isActive ?? true,
      sortOrder: initialData?.sortOrder ?? 0,
      products: initialData?.products?.map((p) => ({
        productId: p.product.id,
        quantity: p.quantity,
      })) ?? [],
    },
  });

  // Sync selectedProducts → form.products
  useEffect(() => {
    form.setValue(
      "products",
      selectedProducts.map((p) => ({
        productId: p.productId,
        quantity: p.quantity,
      })),
    );
  }, [selectedProducts, form]);

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      const prods = initialData.products?.map((p) => ({
        productId: p.product.id,
        productName: p.product.name,
        price: p.product.price,
        quantity: p.quantity,
      })) ?? [];
      setSelectedProducts(prods);
      form.reset({
        name: initialData.name,
        description: initialData.description ?? "",
        price: initialData.price ?? "",
        isActive: initialData.isActive,
        sortOrder: initialData.sortOrder,
        products: prods.map((p) => ({
          productId: p.productId,
          quantity: p.quantity,
        })),
      });
    }
  }, [initialData, form]);

  const createMutation = useMutation({
    mutationFn: (data: CreateMenu) => createMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      router.push("/menus");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateMenu) => updateMenu(initialData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      queryClient.invalidateQueries({ queryKey: ["menu", initialData!.id] });
      router.push("/menus");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMenu(initialData!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      router.push("/menus");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const onSubmit = form.handleSubmit((data) => {
    if (isEditMode) {
      updateMutation.mutate(data as UpdateMenu);
    } else {
      createMutation.mutate(data as CreateMenu);
    }
  });

  const addProduct = (product: { id: string; name: string; price: string }) => {
    const existing = selectedProducts.find((p) => p.productId === product.id);
    if (existing) {
      setSelectedProducts(
        selectedProducts.map((p) =>
          p.productId === product.id
            ? { ...p, quantity: p.quantity + 1 }
            : p,
        ),
      );
    } else {
      setSelectedProducts([
        ...selectedProducts,
        {
          productId: product.id,
          productName: product.name,
          price: product.price,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setSelectedProducts(
      selectedProducts
        .map((p) =>
          p.productId === productId
            ? { ...p, quantity: Math.max(0, p.quantity + delta) }
            : p,
        )
        .filter((p) => p.quantity > 0),
    );
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(
      selectedProducts.filter((p) => p.productId !== productId),
    );
  };

  const filteredProducts = productsData?.data.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Modifier le menu" : "Nouveau menu"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du menu" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du menu..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prix du menu</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Laisser vide pour la somme des produits"
                      className="max-w-[300px]"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sortOrder"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordre d'affichage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      className="max-w-[200px]"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Product selection */}
            <div className="space-y-3">
              <FormLabel>Produits</FormLabel>

              {/* Selected products list */}
              {selectedProducts.length > 0 && (
                <div className="space-y-2 rounded-lg border p-3">
                  {selectedProducts.map((sp) => (
                    <div
                      key={sp.productId}
                      className="flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">
                          {sp.productName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(sp.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(sp.productId, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">
                          {sp.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => updateQuantity(sp.productId, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeProduct(sp.productId)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground pt-1 border-t">
                    {selectedProducts.reduce((sum, p) => sum + p.quantity, 0)} produit(s) au total
                  </p>
                </div>
              )}

              {/* Product search & picker */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un produit à ajouter..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="max-h-[200px] overflow-y-auto rounded-lg border p-2">
                  {filteredProducts?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Aucun produit disponible
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredProducts?.map((product) => {
                        const inList = selectedProducts.find(
                          (p) => p.productId === product.id,
                        );
                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addProduct(product)}
                            className="flex items-center justify-between w-full rounded-md p-2 text-left text-sm hover:bg-muted transition-colors"
                          >
                            <span className="truncate">{product.name}</span>
                            <span className="text-muted-foreground shrink-0 ml-2">
                              {inList ? (
                                <span className="text-primary font-medium">
                                  x{inList.quantity}
                                </span>
                              ) : (
                                formatCurrency(product.price)
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Actif</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Le menu sera visible pour les clients
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between pt-4">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Êtes-vous sûr de vouloir supprimer ce menu ?")) {
                      deleteMutation.mutate();
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Supprimer
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEditMode ? "Enregistrer" : "Créer"}
              </Button>
            </div>

            {error && (
              <p className="text-sm text-destructive">
                Erreur: {(error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
