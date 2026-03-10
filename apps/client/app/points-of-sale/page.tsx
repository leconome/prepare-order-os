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
import { type PointOfSale, fetchPointsOfSale } from "@/lib/api";

function PointsOfSaleTable({ pointsOfSale }: { pointsOfSale: PointOfSale[] }) {
  if (pointsOfSale.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucun point de vente trouvé
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Adresse</TableHead>
          <TableHead>Téléphone</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pointsOfSale.map((pos) => (
          <TableRow
            key={pos.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={`/points-of-sale/${pos.id}`}
                className="hover:text-primary"
              >
                {pos.name}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/points-of-sale/${pos.id}`} className="block w-full">
                {pos.type === "pickup_location" ? (
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800">
                    Point de retrait
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800">
                    Point de vente
                  </span>
                )}
              </Link>
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-muted-foreground">
              <Link href={`/points-of-sale/${pos.id}`} className="block w-full">
                {pos.address || "-"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/points-of-sale/${pos.id}`} className="block w-full">
                {pos.phone || "-"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/points-of-sale/${pos.id}`} className="block w-full">
                <Badge variant={pos.isActive ? "active" : "inactive"}>
                  {pos.isActive ? "Actif" : "Inactif"}
                </Badge>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PointsOfSaleTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export default function PointsOfSalePage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["points-of-sale"],
    queryFn: () => fetchPointsOfSale({ limit: 50 }),
  });

  return (
    <DashboardLayout
      title="Points de vente"
      description="Gérez vos points de vente et de retrait"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} points de vente au total
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
              <Link href="/points-of-sale/create">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau point de vente
              </Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des points de vente</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PointsOfSaleTableSkeleton />
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
              <PointsOfSaleTable pointsOfSale={data?.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
