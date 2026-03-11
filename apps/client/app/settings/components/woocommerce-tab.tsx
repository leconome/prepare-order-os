"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Key, Loader2, Wifi } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchTenantSettings, generateApiKey } from "@/lib/api";

function formatLastUsed(date: string | null | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export function WooCommerceTab() {
  const queryClient = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: generateApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
    },
  });

  const handleCopy = async () => {
    if (!tenant?.apiKey) return;
    await navigator.clipboard.writeText(tenant.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lastUsed = formatLastUsed(tenant?.apiKeyLastUsedAt as string | null);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle>Cle API</CardTitle>
            <CardDescription>
              Copiez cette cle dans votre plugin WordPress pour connecter
              votre boutique a PrepareOS
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tenant?.apiKey ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={tenant.apiKey}
                className="font-mono text-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {lastUsed && (
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Wifi className="h-3.5 w-3.5" />
                Derniere connexion : {lastUsed}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Aucune cle API configuree
            </span>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Key className="mr-2 h-4 w-4" />
              )}
              Generer une cle API
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
