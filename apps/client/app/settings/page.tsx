"use client";

import { Lock, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

function AccessDenied() {
  const router = useRouter();

  return (
    <DashboardLayout title="Accès refusé" description="">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Accès restreint</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Cette page est réservée aux administrateurs et propriétaires.
          Contactez votre responsable si vous pensez devoir y avoir accès.
        </p>
        <Button onClick={() => router.push("/")}>
          Retour à l'accueil
        </Button>
      </div>
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  const { user, isLoading } = useAuth();

  const canAccessSettings = user?.role === "admin" || user?.role === "owner";

  if (isLoading) {
    return (
      <DashboardLayout title="Paramètres" description="Chargement...">
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
      title="Paramètres"
      description="Configurez votre application"
    >
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Paramètres généraux</CardTitle>
              <CardDescription>
                Configuration générale de l'application
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Bientôt disponible...
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
