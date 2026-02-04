"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard-layout";
import { MenuForm } from "@/components/forms/menu-form";
import { Button } from "@/components/ui/button";

export default function CreateMenuPage() {
  return (
    <DashboardLayout
      title="Nouveau menu"
      description="Créez un nouveau menu composé de produits"
    >
      <div className="space-y-4 max-w-2xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/menus">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux menus
          </Link>
        </Button>

        <MenuForm />
      </div>
    </DashboardLayout>
  );
}
