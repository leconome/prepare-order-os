"use client";

import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Plus, RefreshCw, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { TablePagination } from "@/components/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type Category,
  fetchCategories,
  fetchProducts,
  formatCurrency,
  type Product,
} from "@/lib/api";

function ProductsTable({
  products,
  categories,
}: {
  products: Product[];
  categories: Category[];
}) {
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

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
          <TableHead className="w-15">Image</TableHead>
          <TableHead>Nom</TableHead>
          <TableHead>Catégorie</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Prix</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => {
          const category = product.categoryId
            ? categoryMap.get(product.categoryId)
            : null;
          return (
            <TableRow
              key={product.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <TableCell>
                <Link href={`/products/${product.id}`} className="block">
                  {product.imageUrl ? (
                    <div className="relative h-10 w-10 overflow-hidden rounded-md bg-muted">
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        className="object-contain"
                        sizes="40px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                  )}
                </Link>
              </TableCell>
              <TableCell className="font-medium">
                <Link
                  href={`/products/${product.id}`}
                  className="block w-full hover:text-primary"
                >
                  {product.name}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/products/${product.id}`} className="block w-full">
                  {category ? (
                    <Badge
                      variant="outline"
                      className="gap-1"
                      style={
                        category.color
                          ? {
                              borderColor: category.color,
                              backgroundColor: `${category.color}15`,
                              color: category.color,
                            }
                          : undefined
                      }
                    >
                      {category.color && (
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </Link>
              </TableCell>
              <TableCell className="max-w-[250px] truncate text-muted-foreground">
                <Link href={`/products/${product.id}`} className="block w-full">
                  {product.description || "-"}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/products/${product.id}`} className="block w-full">
                  {product.stock == null ? (
                    <span className="text-muted-foreground text-xs">-</span>
                  ) : product.stock === 0 ? (
                    <Badge variant="destructive">Rupture</Badge>
                  ) : product.stock <= 5 ? (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-300">
                      {product.stock}{(product as any).unitType === "kg" ? " kg" : ""}
                    </Badge>
                  ) : (
                    <span className="text-sm">{product.stock}{(product as any).unitType === "kg" ? " kg" : ""}</span>
                  )}
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/products/${product.id}`} className="block w-full">
                  {formatCurrency(product.price)}{(product as any).unitType === "kg" ? "/kg" : ""}
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
          );
        })}
      </TableBody>
    </Table>
  );
}

function ProductsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 20;

export default function ProductsPage() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [page, setPage] = useState(1);

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["products", selectedCategoryId, page],
    queryFn: () =>
      fetchProducts({
        page,
        limit: PAGE_SIZE,
        categoryId: selectedCategoryId ?? undefined,
      }),
  });

  const categories = categoriesData?.data ?? [];

  return (
    <DashboardLayout
      title="Produits"
      description="Gérez votre catalogue de produits"
    >
      <div className="space-y-4">
        {/* Category filters */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-2">
            Filtrer par catégorie:
          </span>
          <button
            onClick={() => { setSelectedCategoryId(null); setPage(1); }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${
              selectedCategoryId === null
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            Toutes
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                setSelectedCategoryId(
                  selectedCategoryId === category.id ? null : category.id
                );
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors ${
                selectedCategoryId === category.id
                  ? "ring-2 ring-offset-1"
                  : "hover:opacity-80"
              }`}
              style={
                category.color
                  ? {
                      backgroundColor: `${category.color}20`,
                      color: category.color,
                      ...(selectedCategoryId === category.id
                        ? { ringColor: category.color }
                        : {}),
                    }
                  : undefined
              }
            >
              {category.color && (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
              )}
              {category.name}
            </button>
          ))}
          {selectedCategoryId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategoryId(null)}
              className="h-7 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Effacer
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} produits
              {selectedCategoryId &&
                categories.find((c) => c.id === selectedCategoryId) &&
                ` dans "${categories.find((c) => c.id === selectedCategoryId)?.name}"`}
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
            <Button size="sm" asChild className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
              <Link href="/products/create">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau produit
              </Link>
            </Button>
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
              <>
                <ProductsTable
                  products={data?.data ?? []}
                  categories={categories}
                />
                <TablePagination
                  page={data?.pagination.page ?? 1}
                  totalPages={data?.pagination.totalPages ?? 1}
                  total={data?.pagination.total ?? 0}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
