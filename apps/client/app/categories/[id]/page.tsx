"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CategoryForm } from "@/components/forms/category-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchCategory } from "@/lib/api";

export default function CategoryEditPage() {
  const params = useParams();
  const categoryId = params.id as string;

  const { data: category, isLoading } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => fetchCategory(categoryId),
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

  if (!category) {
    return (
      <DashboardLayout title="Catégorie non trouvée" description="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cette catégorie n'existe pas.</p>
          <Button asChild className="mt-4">
            <Link href="/categories">Retour aux catégories</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={category.name}
      description="Modifier les informations de la catégorie"
    >
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/categories">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux catégories
            </Link>
          </Button>
          <Badge variant={category.isActive ? "active" : "inactive"}>
            {category.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <CategoryForm initialData={category} />
      </div>
    </DashboardLayout>
  );
}
