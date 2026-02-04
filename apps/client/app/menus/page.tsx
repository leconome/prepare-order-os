"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createMenuSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  type CreateMenu,
  createMenu,
  fetchMenus,
  fetchProducts,
  type Menu,
} from "@/lib/api";

function MenusTable({ menus }: { menus: Menu[] }) {
  if (menus.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucun menu trouvé
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Ordre</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {menus.map((menu) => (
          <TableRow
            key={menu.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={`/menus/${menu.id}`}
                className="block w-full hover:text-primary"
              >
                {menu.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[300px] truncate text-muted-foreground">
              <Link href={`/menus/${menu.id}`} className="block w-full">
                {menu.description || "-"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/menus/${menu.id}`} className="block w-full">
                {menu.sortOrder}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/menus/${menu.id}`} className="block w-full">
                <Badge variant={menu.isActive ? "active" : "inactive"}>
                  {menu.isActive ? "Actif" : "Inactif"}
                </Badge>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function MenusTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function CreateMenuDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: productsData } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts({ limit: 100, isActive: true }),
  });

  const form = useForm({
    resolver: zodResolver(createMenuSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      sortOrder: 0,
      productIds: [] as string[],
    },
  });

  const createMenuMutation = useMutation({
    mutationFn: (data: CreateMenu) => createMenu(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createMenuMutation.mutate(data as CreateMenu);
  });

  const selectedProductIds = form.watch("productIds") || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau menu
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nouveau menu</DialogTitle>
          <DialogDescription>
            Créez un nouveau menu avec une sélection de produits.
          </DialogDescription>
        </DialogHeader>
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
                    <Textarea placeholder="Description du menu..." {...field} />
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
                  <div className="max-h-[200px] overflow-y-auto rounded-lg border p-3">
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
                                    current.filter((id) => id !== product.id)
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={createMenuMutation.isPending}>
                {createMenuMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
            {createMenuMutation.isError && (
              <p className="text-sm text-destructive">
                Erreur: {(createMenuMutation.error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function MenusPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["menus"],
    queryFn: () => fetchMenus({ limit: 50 }),
  });

  return (
    <DashboardLayout title="Menus" description="Gérez vos menus et formules">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} menus au total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
            <CreateMenuDialog />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des menus</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <MenusTableSkeleton />
            ) : isError ? (
              <div className="py-12 text-center">
                <p className="text-destructive">
                  Erreur de chargement : {(error as Error).message}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  Réessayer
                </Button>
              </div>
            ) : (
              <MenusTable menus={data?.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
