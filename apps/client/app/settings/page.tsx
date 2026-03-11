"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Settings, ShoppingCart } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchTenantSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AccessDenied } from "./components/access-denied";
import { GeneralTab } from "./components/general-tab";
import { SmsTab } from "./components/sms-tab";
import { WooCommerceTab } from "./components/woocommerce-tab";

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();

  const canAccessSettings = user?.role === "admin" || user?.role === "owner";

  const { isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
    enabled: canAccessSettings,
  });

  if (authLoading || tenantLoading) {
    return (
      <DashboardLayout title="Parametres" description="Chargement...">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccessSettings) {
    return <AccessDenied />;
  }

  return (
    <DashboardLayout
      title="Parametres"
      description="Configurez votre application"
    >
      <div className="w-full">
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general">
              <Settings className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="mr-2 h-4 w-4" />
              SMS
            </TabsTrigger>
            <TabsTrigger value="woocommerce">
              <ShoppingCart className="mr-2 h-4 w-4" />
              WooCommerce
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-2">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="sms" className="mt-2">
            <SmsTab />
          </TabsContent>
          <TabsContent value="woocommerce" className="mt-2">
            <WooCommerceTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
