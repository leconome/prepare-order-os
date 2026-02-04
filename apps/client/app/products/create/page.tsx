"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ProductForm } from "@/components/forms/product-form";
import { Button } from "@/components/ui/button";

export default function CreateProductPage() {
  return (
    <DashboardLayout
      title="Nouveau produit"
      description="Ajoutez un nouveau produit au catalogue"
    >
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux produits
          </Link>
        </Button>

        <ProductForm />
      </div>
    </DashboardLayout>
  );
}
