"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PointOfSaleForm } from "@/components/forms/point-of-sale-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPointOfSale } from "@/lib/api";

export default function PointOfSaleEditPage() {
  const params = useParams();
  const posId = params.id as string;

  const { data: pos, isLoading } = useQuery({
    queryKey: ["point-of-sale", posId],
    queryFn: () => fetchPointOfSale(posId),
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement..." description="">
        <div className="space-y-4 max-w-2xl">
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

  if (!pos) {
    return (
      <DashboardLayout title="Point de retrait non trouvé" description="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Ce point de retrait n'existe pas.
          </p>
          <Button asChild className="mt-4">
            <Link href="/points-of-sale">Retour aux points de retrait</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={pos.name}
      description="Modifier les informations du point de retrait"
    >
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/points-of-sale">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux points de retrait
            </Link>
          </Button>
          <Badge variant={pos.isActive ? "active" : "inactive"}>
            {pos.isActive ? "Actif" : "Inactif"}
          </Badge>
        </div>

        <PointOfSaleForm initialData={pos} />
      </div>
    </DashboardLayout>
  );
}
