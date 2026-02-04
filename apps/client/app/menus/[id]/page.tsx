"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MenuForm } from "@/components/forms/menu-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMenu } from "@/lib/api";

export default function MenuEditPage() {
  const params = useParams();
  const menuId = params.id as string;

  const { data: menu, isLoading } = useQuery({
    queryKey: ["menu", menuId],
    queryFn: () => fetchMenu(menuId),
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
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/menus">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux menus
            </Link>
          </Button>
          <Badge variant={menu.isActive ? "active" : "inactive"}>
            {menu.isActive ? "Actif" : "Inactif"}
          </Badge>
        </div>

        <MenuForm initialData={menu} />
      </div>
    </DashboardLayout>
  );
}
