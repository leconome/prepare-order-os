"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { PointOfSaleForm } from "@/components/forms/point-of-sale-form";
import { Button } from "@/components/ui/button";

export default function CreatePointOfSalePage() {
  return (
    <DashboardLayout
      title="Nouveau point de vente"
      description="Créez un nouveau point de vente ou de retrait"
    >
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/points-of-sale">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux points de vente
          </Link>
        </Button>

        <PointOfSaleForm />
      </div>
    </DashboardLayout>
  );
}
