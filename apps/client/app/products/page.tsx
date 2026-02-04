"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createProductSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  type CreateProduct,
  createProduct,
  fetchCategories,
  fetchProducts,
  formatCurrency,
  type Product,
} from "@/lib/api";

function ProductsTable({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucun produit trouvé
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Prix</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow
            key={product.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={`/products/${product.id}`}
                className="block w-full hover:text-primary"
              >
                {product.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[300px] truncate text-muted-foreground">
              <Link href={`/products/${product.id}`} className="block w-full">
                {product.description || "-"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/products/${product.id}`} className="block w-full">
                {formatCurrency(product.price)}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/products/${product.id}`} className="block w-full">
                <Badge variant={product.isActive ? "active" : "inactive"}>
                  {product.isActive ? "Actif" : "Inactif"}
                </Badge>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ProductsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function CreateProductDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(createProductSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      categoryId: undefined,
      imageUrl: "",
      isActive: true,
      sortOrder: 0,
    },
  });

  const createProductMutation = useMutation({
    mutationFn: (data: CreateProduct) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createProductMutation.mutate(data as CreateProduct);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau produit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouveau produit</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau produit au catalogue.
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
                    <Input placeholder="Nom du produit" {...field} />
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
                      placeholder="Description du produit..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix (€)</FormLabel>
                    <FormControl>
                      <Input placeholder="10.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoriesData?.data.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
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
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de l'image (optionnel)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
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
                      Le produit sera visible dans le catalogue
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
              <Button type="submit" disabled={createProductMutation.isPending}>
                {createProductMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
            {createProductMutation.isError && (
              <p className="text-sm text-destructive">
                Erreur: {(createProductMutation.error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetchProducts({ limit: 50 }),
  });

  return (
    <DashboardLayout
      title="Produits"
      description="Gérez votre catalogue de produits"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} produits au total
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
            <CreateProductDialog />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des produits</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ProductsTableSkeleton />
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
              <ProductsTable products={data?.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
