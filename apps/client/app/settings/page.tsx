"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Lock, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fetchTenantSettings, updateTenantSettings } from "@/lib/api";

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
        <Button onClick={() => router.push("/")}>Retour à l'accueil</Button>
      </div>
    </DashboardLayout>
  );
}

const FILTER_DAYS_OPTIONS = [
  { value: "0", label: "Aujourd'hui uniquement" },
  { value: "1", label: "Aujourd'hui + 1 jour avant" },
  { value: "2", label: "Aujourd'hui + 2 jours avant" },
  { value: "3", label: "Aujourd'hui + 3 jours avant" },
  { value: "7", label: "Aujourd'hui + 7 jours avant" },
  { value: "14", label: "Aujourd'hui + 14 jours avant" },
  { value: "30", label: "Aujourd'hui + 30 jours avant" },
];

export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const canAccessSettings = user?.role === "admin" || user?.role === "owner";

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
    enabled: canAccessSettings,
  });

  const [name, setName] = useState("");
  const [filterDays, setFilterDays] = useState("0");

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setFilterDays(String(tenant.preparationFilterDays));
    }
  }, [tenant]);

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
  });

  const handleSave = () => {
    mutation.mutate({
      name,
      preparationFilterDays: Number(filterDays),
    });
  };

  const hasChanges =
    tenant &&
    (name !== tenant.name ||
      Number(filterDays) !== tenant.preparationFilterDays);

  if (authLoading || tenantLoading) {
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
      <div className="space-y-6 max-w-2xl">
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
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="shop-name">Nom de la boutique</Label>
              <Input
                id="shop-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de votre boutique"
              />
              <p className="text-xs text-muted-foreground">
                Affiché dans la barre latérale et sur la page de connexion.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-days">
                Filtre de la vue préparation
              </Label>
              <Select value={filterDays} onValueChange={setFilterDays}>
                <SelectTrigger id="filter-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_DAYS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Nombre de jours affichés dans l'onglet préparation.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                disabled={!hasChanges || mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : mutation.isSuccess && !hasChanges ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : null}
                {mutation.isSuccess && !hasChanges
                  ? "Enregistré"
                  : "Enregistrer"}
              </Button>
              {mutation.isError && (
                <span className="text-sm text-destructive">
                  Erreur lors de la sauvegarde
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
