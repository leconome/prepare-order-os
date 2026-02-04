"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { CategoryForm } from "@/components/forms/category-form";
import { Button } from "@/components/ui/button";

export default function CreateCategoryPage() {
  return (
    <DashboardLayout
      title="Nouvelle catégorie"
      description="Créez une nouvelle catégorie pour organiser vos produits"
    >
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/categories">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux catégories
          </Link>
        </Button>

        <CategoryForm />
      </div>
    </DashboardLayout>
  );
}
