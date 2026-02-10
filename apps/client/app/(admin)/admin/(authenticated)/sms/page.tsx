"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  MessageSquare,
  Minus,
  Plus,
  Store,
} from "lucide-react";
import { useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAdminSmsCredits,
  fetchAdminSmsTenants,
  grantSmsCredits,
  revokeSmsCredits,
  type SmsTenant,
} from "@/lib/api";

export default function AdminSmsPage() {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    mode: "grant" | "revoke";
    tenant: SmsTenant | null;
  }>({ open: false, mode: "grant", tenant: null });
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const { data: ovhCredits, isLoading: ovhLoading } = useQuery({
    queryKey: ["admin-sms-credits"],
    queryFn: fetchAdminSmsCredits,
  });

  const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
    queryKey: ["admin-sms-tenants"],
    queryFn: fetchAdminSmsTenants,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!dialogState.tenant) return;
      const data = {
        amount: Number(amount),
        description: description || undefined,
      };
      if (dialogState.mode === "grant") {
        return grantSmsCredits(dialogState.tenant.id, data);
      }
      return revokeSmsCredits(dialogState.tenant.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-sms-tenants"] });
      queryClient.invalidateQueries({ queryKey: ["admin-sms-credits"] });
      closeDialog();
    },
  });

  const tenants = tenantsData?.data ?? [];
  const totalDistributed = tenantsData?.totalDistributed ?? 0;
  const available = tenantsData?.available;

  // Max for grant dialog: available credits (OVH - distributed)
  const maxGrant = available ?? undefined;

  function openDialog(mode: "grant" | "revoke", tenant: SmsTenant) {
    setDialogState({ open: true, mode, tenant });
    setAmount("");
    setDescription("");
  }

  function closeDialog() {
    setDialogState({ open: false, mode: "grant", tenant: null });
    setAmount("");
    setDescription("");
  }

  const grantDisabled = available != null && available <= 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">SMS</h1>
        <p className="text-muted-foreground">
          Gestion des credits SMS OVH et attribution aux tenants
        </p>
      </div>

      <div className="space-y-6">
        {/* OVH Platform Credits */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Credits OVH
            </CardTitle>
            <CardDescription>
              Credits SMS disponibles sur le compte OVH plateforme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ovhLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : ovhCredits && !("error" in ovhCredits) ? (
              <div className="flex flex-wrap items-center gap-6">
                <div>
                  <span className="text-3xl font-bold">
                    {ovhCredits.creditsLeft}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    credits OVH
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {totalDistributed}
                  </span>{" "}
                  distribues &middot;{" "}
                  <span className="font-medium text-foreground">
                    {available ?? "?"}
                  </span>{" "}
                  disponibles
                </div>
                <a
                  href={ovhCredits.buyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Acheter des credits
                  </Button>
                </a>
              </div>
            ) : (
              <p className="text-muted-foreground">
                OVH SMS non configure. Ajoutez les variables d'environnement
                OVH_APP_KEY, OVH_APP_SECRET, OVH_CONSUMER_KEY et
                OVH_SMS_SERVICE_NAME.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tenant Credits Table */}
        <Card>
          <CardHeader>
            <CardTitle>Credits par tenant</CardTitle>
            <CardDescription>
              Attribuez ou revoquez des credits SMS pour chaque tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenantsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                Aucun tenant trouve
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead className="text-right">
                      Credits SMS
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-muted-foreground" />
                          {tenant.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="font-mono text-xs"
                        >
                          {tenant.slug}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tenant.smsCredits}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog("grant", tenant)}
                            disabled={grantDisabled}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Attribuer
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDialog("revoke", tenant)}
                            disabled={tenant.smsCredits === 0}
                          >
                            <Minus className="mr-1 h-3 w-3" />
                            Revoquer
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Grant / Revoke Dialog */}
      <Dialog open={dialogState.open} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState.mode === "grant"
                ? "Attribuer des credits"
                : "Revoquer des credits"}
            </DialogTitle>
            <DialogDescription>
              {dialogState.mode === "grant"
                ? `Ajoutez des credits SMS a ${dialogState.tenant?.name}. ${maxGrant !== undefined ? `${maxGrant} credit(s) disponible(s) a attribuer.` : ""}`
                : `Retirez des credits SMS de ${dialogState.tenant?.name} (solde actuel : ${dialogState.tenant?.smsCredits})`}
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
              <Label htmlFor="amount">Nombre de credits</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                max={
                  dialogState.mode === "revoke"
                    ? dialogState.tenant?.smsCredits
                    : maxGrant
                }
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              {dialogState.mode === "grant" && maxGrant !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Maximum : {maxGrant} (credits OVH restants - credits deja distribues)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Raison de l'attribution..."
                rows={2}
              />
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {mutation.error?.message || "Erreur"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
              >
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
                {mutation.isPending
                  ? "En cours..."
                  : dialogState.mode === "grant"
                    ? "Attribuer"
                    : "Revoquer"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
