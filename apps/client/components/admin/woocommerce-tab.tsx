"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Globe,
  Loader2,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  backfillWooCommerce,
  connectWooCommerce,
  disconnectWooCommerce,
  fetchWooCommerceConnection,
  fetchWooCommerceHealth,
  fetchWooCommerceLogs,
  formatDate,
  syncWooCommerce,
  toggleWooCommerce,
  type WooCommerceConnectionResponse,
  type WooCommerceSyncLogResponse,
} from "@/lib/api";

// ============ HELPERS ============

const ACTION_LABELS: Record<string, string> = {
  product_push: "Produit",
  category_push: "Catégorie",
  variant_push: "Variante",
  stock_push: "Stock",
  order_received: "Commande",
  backfill: "Backfill",
  webhook_registered: "Webhook",
  connection_test: "Connexion",
  error: "Erreur",
};

// ============ CONNECT FORM ============

function WooCommerceConnectForm({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: { storeUrl: "", consumerKey: "", consumerSecret: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: {
      storeUrl: string;
      consumerKey: string;
      consumerSecret: string;
    }) => connectWooCommerce(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-connection", tenantId],
      });
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Connexion WooCommerce
        </CardTitle>
        <CardDescription>
          Connectez une boutique WooCommerce pour synchroniser les produits et
          commandes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storeUrl">URL de la boutique</Label>
            <Input
              id="storeUrl"
              placeholder="https://ma-boutique.com"
              {...form.register("storeUrl", { required: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumerKey">Consumer Key</Label>
            <Input
              id="consumerKey"
              placeholder="ck_..."
              {...form.register("consumerKey", { required: true })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumerSecret">Consumer Secret</Label>
            <Input
              id="consumerSecret"
              type="password"
              placeholder="cs_..."
              {...form.register("consumerSecret", { required: true })}
            />
          </div>
          {mutation.isError && (
            <p className="text-sm text-destructive">
              {(mutation.error as Error).message || "Erreur de connexion"}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Tester et connecter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============ STATUS CARD ============

function WooCommerceStatusCard({
  tenantId,
  connection,
}: {
  tenantId: string;
  connection: WooCommerceConnectionResponse;
}) {
  const queryClient = useQueryClient();
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const { data: healthData } = useQuery({
    queryKey: ["admin-wc-health", tenantId],
    queryFn: () => fetchWooCommerceHealth(tenantId),
    enabled: connection.isEnabled,
  });

  const toggleMutation = useMutation({
    mutationFn: () => toggleWooCommerce(tenantId, !connection.isEnabled),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-connection", tenantId],
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectWooCommerce(tenantId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-connection", tenantId],
      });
      setDisconnectOpen(false);
    },
  });

  const health = healthData?.data;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              WooCommerce
              <span className="flex items-center gap-1.5">
                {health ? (
                  health.connected ? (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"
                      title="Connexion au store WooCommerce active"
                    />
                  ) : (
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
                      title={`Impossible de joindre le store WooCommerce${health.error ? ` : ${health.error}` : ""}`}
                    />
                  )
                ) : null}
              </span>
            </CardTitle>
            <CardDescription>{connection.storeUrl}</CardDescription>
          </div>
          <Badge variant={connection.isEnabled ? "active" : "inactive"}>
            {connection.isEnabled ? "Actif" : "Désactivé"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Connecté depuis
            </dt>
            <dd className="text-sm">{formatDate(connection.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Dernière synchronisation
            </dt>
            <dd className="text-sm">
              {connection.lastSyncAt
                ? formatDate(connection.lastSyncAt)
                : "Jamais"}
            </dd>
          </div>
          {health?.wcVersion && (
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Version WooCommerce
              </dt>
              <dd className="text-sm">{health.wcVersion}</dd>
            </div>
          )}
          {health?.storeName && (
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Nom de la boutique
              </dt>
              <dd className="text-sm">{health.storeName}</dd>
            </div>
          )}
        </dl>

        {health?.webhooks && health.webhooks.length > 0 && (
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Webhooks
            </p>
            <div className="flex flex-wrap gap-2">
              {health.webhooks.map((wh) => (
                <Badge
                  key={wh.id}
                  variant={wh.status === "active" ? "active" : "inactive"}
                >
                  {wh.topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {health?.error && (
          <p className="text-sm text-destructive">{health.error}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {connection.isEnabled ? (
              <>
                <PowerOff className="mr-1 h-3 w-3" />
                Désactiver
              </>
            ) : (
              <>
                <Power className="mr-1 h-3 w-3" />
                Activer
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => setDisconnectOpen(true)}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Déconnecter
          </Button>
        </div>
      </CardContent>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Déconnecter WooCommerce</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir déconnecter cette boutique WooCommerce ?
              Les webhooks seront supprimés.
            </DialogDescription>
          </DialogHeader>
          {disconnectMutation.isError && (
            <p className="text-sm text-destructive">
              {(disconnectMutation.error as Error).message || "Erreur"}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ ACTIONS ============

function WooCommerceActions({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: () => syncWooCommerce(tenantId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-connection", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-logs", tenantId],
      });
      const d = res.data;
      const msg = `Synchronisé : ${d.categories} catégories, ${d.products} produits, ${d.variants} variantes`;
      setSyncResult(d.errors?.length ? `${msg} (${d.errors.length} erreur(s))` : msg);
    },
    onError: (e) => setSyncResult(`Erreur : ${e instanceof Error ? e.message : "Sync échouée"}`),
  });

  const backfillMutation = useMutation({
    mutationFn: () => backfillWooCommerce(tenantId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-connection", tenantId],
      });
      queryClient.invalidateQueries({
        queryKey: ["admin-wc-logs", tenantId],
      });
      setBackfillOpen(false);
      const d = res.data;
      const msg = `Backfill terminé : ${d.categories} catégories, ${d.products} produits, ${d.variants} variantes`;
      setBackfillResult(d.errors?.length ? `${msg} (${d.errors.length} erreur(s) — voir le journal)` : msg);
    },
    onError: (e) => setBackfillResult(`Erreur : ${e instanceof Error ? e.message : "Backfill échoué"}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>
          Synchroniser les données depuis ou vers WooCommerce
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSyncResult(null);
              syncMutation.mutate();
            }}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Synchroniser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBackfillResult(null);
              setBackfillOpen(true);
            }}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Upload className="mr-1 h-3 w-3" />
            )}
            Backfill vers WooCommerce
          </Button>
        </div>

        {syncMutation.isError && (
          <p className="text-sm text-destructive">
            {(syncMutation.error as Error).message ||
              "Erreur de synchronisation"}
          </p>
        )}
        {syncResult && (
          <p className="text-sm text-emerald-600 flex items-center gap-1">
            <Check className="h-3 w-3" />
            {syncResult}
          </p>
        )}

        {backfillMutation.isError && (
          <p className="text-sm text-destructive">
            {(backfillMutation.error as Error).message ||
              "Erreur de backfill"}
          </p>
        )}
        {backfillResult && (
          <p className="text-sm text-emerald-600 flex items-center gap-1">
            <Check className="h-3 w-3" />
            {backfillResult}
          </p>
        )}

        <Dialog open={backfillOpen} onOpenChange={setBackfillOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Backfill vers WooCommerce</DialogTitle>
              <DialogDescription>
                Cette action va envoyer tous les produits, catégories et
                variantes vers WooCommerce. Continuer ?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBackfillOpen(false)}
              >
                Annuler
              </Button>
              <Button
                onClick={() => backfillMutation.mutate()}
                disabled={backfillMutation.isPending}
              >
                {backfillMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Lancer le backfill
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============ SYNC LOG ============

function WooCommerceSyncLog({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-wc-logs", tenantId],
    queryFn: () => fetchWooCommerceLogs(tenantId),
  });

  const logs = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal de synchronisation</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Aucun log de synchronisation
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Détails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(log.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.status === "success" ? "active" : "inactive"
                      }
                    >
                      {log.status === "success" ? "OK" : "Erreur"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                    {log.summary || log.details || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ============ MAIN TAB ============

export function WooCommerceTab({ tenantId }: { tenantId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-wc-connection", tenantId],
    queryFn: () => fetchWooCommerceConnection(tenantId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const connection = data?.data;

  if (!connection) {
    return <WooCommerceConnectForm tenantId={tenantId} />;
  }

  return (
    <div className="space-y-6">
      <WooCommerceStatusCard tenantId={tenantId} connection={connection} />
      <WooCommerceActions tenantId={tenantId} />
      <WooCommerceSyncLog tenantId={tenantId} />
    </div>
  );
}
