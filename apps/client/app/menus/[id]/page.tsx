"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { updateMenuSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type MenuWithProducts,
  type UpdateMenu,
  deleteMenu,
  fetchMenu,
  fetchProducts,
  updateMenu,
} from "@/lib/api";

export default function MenuEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const menuId = params.id as string;

  const { data: menu, isLoading } = useQuery({
    queryKey: ["menu", menuId],
    queryFn: () => fetchMenu(menuId),
  });

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(updateMenuSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      sortOrder: 0,
      productIds: [] as string[],
    },
  });

  useEffect(() => {
    if (menu) {
      form.reset({
        name: menu.name,
        description: menu.description || "",
        isActive: menu.isActive,
        sortOrder: menu.sortOrder,
        productIds: menu.products?.map((p) => p.id) || [],
      });
    }
  }, [menu, form]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateMenu) => updateMenu(menuId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      queryClient.invalidateQueries({ queryKey: ["menu", menuId] });
      router.push("/menus");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMenu(menuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      router.push("/menus");
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(data as UpdateMenu);
  });

  const selectedProductIds = form.watch("productIds") || [];

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement..." description="">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!menu) {
    return (
      <DashboardLayout title="Menu non trouvé" description="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ce menu n'existe pas.</p>
          <Button asChild className="mt-4">
            <Link href="/menus">Retour aux menus</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={menu.name}
      description="Modifier les informations du menu"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/menus">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <Badge variant={menu.isActive ? "active" : "inactive"}>
            {menu.isActive ? "Actif" : "Inactif"}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations du menu</CardTitle>
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
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
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
                      <div className="max-h-[250px] overflow-y-auto rounded-lg border p-3">
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
                                  checked={selectedProductIds.includes(
                                    product.id
                                  )}
                                  onCheckedChange={(checked) => {
                                    const current =
                                      form.getValues("productIds") || [];
                                    if (checked) {
                                      form.setValue("productIds", [
                                        ...current,
                                        product.id,
                                      ]);
                                    } else {
                                      form.setValue(
                                        "productIds",
                                        current.filter(
                                          (id) => id !== product.id
                                        )
                                      );
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={product.id}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {product.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (
                        confirm("Êtes-vous sûr de vouloir supprimer ce menu ?")
                      ) {
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
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Enregistrer
                  </Button>
                </div>
                {updateMutation.isError && (
                  <p className="text-sm text-destructive">
                    Erreur: {(updateMutation.error as Error).message}
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
