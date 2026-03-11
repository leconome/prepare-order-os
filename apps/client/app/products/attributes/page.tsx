"use client";

import { DashboardLayout } from "@/components/dashboard-layout";
import { AttributesTab } from "@/app/settings/components/attributes-tab";

export default function AttributesPage() {
  return (
    <DashboardLayout
      title="Attributs"
      description="Gérez les attributs et termes pour les variantes de produits"
    >
      <AttributesTab />
    </DashboardLayout>
  );
}
