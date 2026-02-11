"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Settings } from "lucide-react";
import { useEffect, useState } from "react";
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
import { fetchTenantSettings, updateTenantSettings } from "@/lib/api";
import { FILTER_DAYS_OPTIONS } from "../constants";

export function GeneralTab() {
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Parametres generaux</CardTitle>
            <CardDescription>
              Configuration generale de l'application
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
            Affiche dans la barre laterale et sur la page de connexion.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="filter-days">Filtre de la vue preparation</Label>
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
            Nombre de jours affiches dans l'onglet preparation.
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
            {mutation.isSuccess && !hasChanges ? "Enregistre" : "Enregistrer"}
          </Button>
          {mutation.isError && (
            <span className="text-sm text-destructive">
              Erreur lors de la sauvegarde
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
