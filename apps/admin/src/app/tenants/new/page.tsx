"use client";

import { Header } from "@/components/layout/header";
import { CreateTenantForm } from "@/components/tenants/create-tenant-form";

export default function NewTenantPage() {
  return (
    <div>
      <Header title="Create Tenant" />
      <div className="p-6">
        <CreateTenantForm />
      </div>
    </div>
  );
}
