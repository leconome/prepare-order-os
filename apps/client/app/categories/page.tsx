"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
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
import { ColorBadge } from "@/components/color-picker";
import { type Category, fetchCategories } from "@/lib/api";

function CategoriesTable({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucune catégorie trouvée
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Couleur</TableHead>
          <TableHead>Nom</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Ordre</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow
            key={category.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <TableCell>
              <Link href={`/categories/${category.id}`} className="block w-full">
                <ColorBadge color={category.color} />
                {!category.color && <span className="text-muted-foreground">-</span>}
              </Link>
            </TableCell>
            <TableCell className="font-medium">
              <Link
                href={`/categories/${category.id}`}
                className="flex items-center gap-2 hover:text-primary"
              >
                {category.color && (
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                {category.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[300px] truncate text-muted-foreground">
              <Link href={`/categories/${category.id}`} className="block w-full">
                {category.description || "-"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/categories/${category.id}`} className="block w-full">
                {category.sortOrder}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/categories/${category.id}`} className="block w-full">
                <Badge variant={category.isActive ? "active" : "inactive"}>
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CategoriesTableSkeleton() {
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

export default function CategoriesPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 50 }),
  });

  return (
    <DashboardLayout
      title="Catégories"
      description="Organisez vos produits par catégories"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} catégories au total
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
              <Link href="/categories/create">
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle catégorie
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des catégories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <CategoriesTableSkeleton />
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
              <CategoriesTable categories={data?.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
