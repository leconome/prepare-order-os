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
import { fetchMenus, type Menu } from "@/lib/api";

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
            <Button size="sm" asChild className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
              <Link href="/menus/create">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau menu
              </Link>
            </Button>
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
