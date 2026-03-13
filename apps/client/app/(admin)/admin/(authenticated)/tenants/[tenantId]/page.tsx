"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createOwnerSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageSquare,
  Minus,
  Plus,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminUser,
  type SmsTenant,
  createTenantOwner,
  fetchAdminSmsCredits,
  fetchAdminSmsTenants,
  fetchAdminTenantTransactions,
  fetchTenant,
  fetchTenantOwners,
  formatDate,
  grantSmsCredits,
  revokeSmsCredits,
  toggleOwnerActive,
} from "@/lib/api";

// ============ INFORMATIONS TAB ============

function InformationsTab({ tenant }: { tenant: { name: string; slug: string; preparationFilterDays: number; smsCredits: number; ownerCount: number; createdAt: string | Date } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Informations</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Nom</dt>
            <dd className="text-sm">{tenant.name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
            <dd className="text-sm">
              <Badge variant="outline" className="font-mono text-xs">
                {tenant.slug}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Filtre préparation</dt>
            <dd className="text-sm">
              {tenant.preparationFilterDays} jour{tenant.preparationFilterDays !== 1 ? "s" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Créé le</dt>
            <dd className="text-sm">{formatDate(tenant.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Crédits SMS</dt>
            <dd className="text-sm font-mono">{tenant.smsCredits}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Propriétaires</dt>
            <dd className="text-sm">{tenant.ownerCount}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

// ============ SMS TAB ============

function SmsTab({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "grant" | "revoke";
  }>({ open: false, mode: "grant" });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const { data: ovhCredits, isLoading: ovhLoading } = useQuery({
    queryKey: ["admin-sms-credits"],
    queryFn: fetchAdminSmsCredits,
  });

  const { data: tenantsData } = useQuery({
    queryKey: ["admin-sms-tenants"],
    queryFn: fetchAdminSmsTenants,
  });

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: ["admin-tenant-transactions", tenantId],
    queryFn: () => fetchAdminTenantTransactions(tenantId, { limit: 50 }),
  });

  const thisTenant = tenantsData?.data?.find((t) => t.id === tenantId);
  const totalDistributed = tenantsData?.totalDistributed ?? 0;
  const available = tenantsData?.available;
  const maxGrant = available ?? undefined;
  const grantDisabled = available != null && available <= 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        amount: Number(amount),
        description: description || undefined,
      };
      if (dialogState.mode === "grant") {
        return grantSmsCredits(tenantId, data);
      }
      return revokeSmsCredits(tenantId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sms-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sms-credits"] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-transactions", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant", tenantId] });
      closeDialog();
    },
  });

  function openDialog(mode: "grant" | "revoke") {
    setDialogState({ open: true, mode });
    setAmount("");
    setDescription("");
  }

  function closeDialog() {
    setDialogState({ open: false, mode: "grant" });
    setAmount("");
    setDescription("");
  }

  const TX_TYPE_LABELS: Record<string, string> = {
    grant: "Attribution",
    spend: "Envoi SMS",
    revoke: "Révocation",
  };

  return (
    <div className="space-y-6">
      {/* OVH Platform Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Crédits OVH (plateforme)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ovhLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : ovhCredits && !("error" in ovhCredits) ? (
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <span className="text-3xl font-bold">{ovhCredits.creditsLeft}</span>
                <span className="ml-2 text-muted-foreground">crédits OVH</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{totalDistributed}</span> distribués &middot;{" "}
                <span className="font-medium text-foreground">{available ?? "?"}</span> disponibles
              </div>
              <a href={ovhCredits.buyUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Acheter des crédits
                </Button>
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground">OVH SMS non configuré.</p>
          )}
        </CardContent>
      </Card>

      {/* Tenant Credit Balance + Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Crédits de {tenantName}</CardTitle>
              <CardDescription>Solde actuel et actions</CardDescription>
            </div>
            <div className="text-3xl font-bold font-mono">{thisTenant?.smsCredits ?? 0}</div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => openDialog("grant")} disabled={grantDisabled}>
              <Plus className="mr-1 h-3 w-3" />
              Attribuer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog("revoke")}
              disabled={!thisTenant || thisTenant.smsCredits === 0}
            >
              <Minus className="mr-1 h-3 w-3" />
              Révoquer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !transactionsData?.data?.length ? (
            <div className="py-8 text-center text-muted-foreground">
              Aucune transaction
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsData.data.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {tx.type === "revoke" || tx.type === "spend" ? "-" : "+"}
                      {tx.amount}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Grant / Revoke Dialog */}
      <Dialog open={dialogState.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "grant" ? "Attribuer des crédits" : "Révoquer des crédits"}
            </DialogTitle>
            <DialogDescription>
              {dialogState.mode === "grant"
                ? `Ajoutez des crédits SMS à ${tenantName}. ${maxGrant !== undefined ? `${maxGrant} crédit(s) disponible(s).` : ""}`
                : `Retirez des crédits SMS de ${tenantName} (solde : ${thisTenant?.smsCredits ?? 0})`}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="amount">Nombre de crédits</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max={dialogState.mode === "revoke" ? thisTenant?.smsCredits : maxGrant}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Raison..."
                rows={2}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  !amount ||
                  Number(amount) < 1 ||
                  (dialogState.mode === "grant" && maxGrant !== undefined && Number(amount) > maxGrant) ||
                  mutation.isPending
                }
              >
                {mutation.isPending ? "En cours..." : dialogState.mode === "grant" ? "Attribuer" : "Révoquer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ OWNERS TAB ============

function CreateOwnerDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createOwnerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      createTenantOwner(tenantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-owners", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant", tenantId] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); mutation.reset(); } }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un propriétaire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouveau propriétaire</DialogTitle>
          <DialogDescription>
            Créez un compte propriétaire pour ce tenant.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Jean Dupont" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jean@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormDescription>8 caractères minimum</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur lors de la création"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function OwnersTab({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tenant-owners", tenantId],
    queryFn: () => fetchTenantOwners(tenantId),
  });

  const toggleMutation = useMutation({
    mutationFn: (userId: string) => toggleOwnerActive(tenantId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-owners", tenantId] });
    },
  });

  const owners = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Propriétaires</CardTitle>
            <CardDescription>Comptes propriétaires de ce tenant</CardDescription>
          </div>
          <CreateOwnerDialog tenantId={tenantId} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : owners.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Aucun propriétaire
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map((owner) => (
                <TableRow key={owner.id}>
                  <TableCell className="font-medium">{owner.name || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{owner.email}</TableCell>
                  <TableCell>
                    <Badge variant={owner.isActive ? "active" : "inactive"}>
                      {owner.isActive ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(owner.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Êtes-vous sûr de vouloir ${owner.isActive ? "désactiver" : "réactiver"} ce propriétaire ?`)) {
                          toggleMutation.mutate(owner.id);
                        }
                      }}
                      disabled={toggleMutation.isPending}
                    >
                      {owner.isActive ? "Désactiver" : "Réactiver"}
                    </Button>
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

// ============ MAIN PAGE ============

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tenant", tenantId],
    queryFn: () => fetchTenant(tenantId),
  });

  const tenant = data?.data;

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Tenant non trouvé</p>
        <Link href="/admin">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Tenants
        </Link>
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">{tenant.name}</h1>
          <Badge variant="outline" className="font-mono text-xs">
            {tenant.slug}
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="owners" className="gap-2">
            <Users className="h-4 w-4" />
            Propriétaires
          </TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-4">
          <InformationsTab tenant={tenant} />
        </TabsContent>
        <TabsContent value="sms" className="mt-4">
          <SmsTab tenantId={tenantId} tenantName={tenant.name} />
        </TabsContent>
        <TabsContent value="owners" className="mt-4">
          <OwnersTab tenantId={tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
