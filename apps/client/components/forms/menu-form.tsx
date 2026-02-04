"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createMenuSchema, updateMenuSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  updateMenu,
} from "@/lib/api";

interface MenuFormProps {
  initialData?: MenuWithProducts;
}

export function MenuForm({ initialData }: MenuFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(isEditMode ? updateMenuSchema : createMenuSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      isActive: initialData?.isActive ?? true,
      sortOrder: initialData?.sortOrder ?? 0,
      productIds: initialData?.products?.map((p) => p.id) ?? [],
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        description: initialData.description ?? "",
        isActive: initialData.isActive,
        sortOrder: initialData.sortOrder,
        productIds: initialData.products?.map((p) => p.id) ?? [],
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

  const selectedProductIds = form.watch("productIds") || [];

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

            <FormField
              control={form.control}
              name="productIds"
              render={() => (
                <FormItem>
                  <FormLabel>Produits</FormLabel>
                  <div className="max-h-[300px] overflow-y-auto rounded-lg border p-3">
                    {productsData?.data.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Aucun produit disponible
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {productsData?.data.map((product) => (
                          <div
                            key={product.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={product.id}
                              checked={selectedProductIds.includes(product.id)}
                              onCheckedChange={(checked) => {
                                const current = form.getValues("productIds") || [];
                                if (checked) {
                                  form.setValue("productIds", [
                                    ...current,
                                    product.id,
                                  ]);
                                } else {
                                  form.setValue(
                                    "productIds",
                                    current.filter((id) => id !== product.id)
                                  );
                                }
                              }}
                            />
                            <label
                              htmlFor={product.id}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {product.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedProductIds.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedProductIds.length} produit(s) sélectionné(s)
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

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
