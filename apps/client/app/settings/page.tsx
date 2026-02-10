"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Lock,
  MessageSquare,
  RefreshCw,
  Send,
  Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
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
import { useAuth } from "@/lib/auth";
import {
  fetchSmsCredits,
  fetchSmsMessages,
  fetchSmsTransactions,
  fetchTenantSettings,
  formatDate,
  refreshSmsStatus,
  sendSms,
  updateTenantSettings,
  type SmsMessage,
} from "@/lib/api";

function AccessDenied() {
  const router = useRouter();

  return (
    <DashboardLayout title="Acces refuse" description="">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Acces restreint</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Cette page est reservee aux administrateurs et proprietaires.
          Contactez votre responsable si vous pensez devoir y avoir acces.
        </p>
        <Button onClick={() => router.push("/")}>Retour a l'accueil</Button>
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

const SMS_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  sent: "Envoye",
  delivered: "Delivre",
  failed: "Echoue",
};

const SMS_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
};

const TX_TYPE_LABELS: Record<string, string> = {
  grant: "Attribution",
  spend: "Envoi SMS",
  revoke: "Revocation",
};

// ── General Settings Tab ─────────────────────────────

function GeneralTab() {
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
          <Label htmlFor="filter-days">
            Filtre de la vue preparation
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
            {mutation.isSuccess && !hasChanges
              ? "Enregistre"
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
  );
}

// ── SMS Tab ──────────────────────────────────────────

function SmsTab() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [content, setContent] = useState("");

  const { data: creditsData } = useQuery({
    queryKey: ["sms-credits"],
    queryFn: fetchSmsCredits,
  });

  const { data: messagesData } = useQuery({
    queryKey: ["sms-messages"],
    queryFn: () => fetchSmsMessages({ limit: 20 }),
  });

  const { data: transactionsData } = useQuery({
    queryKey: ["sms-transactions"],
    queryFn: () => fetchSmsTransactions({ limit: 20 }),
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      sendSms({
        recipientPhone: phone,
        recipientName: recipientName || undefined,
        content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-credits"] });
      queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
      queryClient.invalidateQueries({ queryKey: ["sms-transactions"] });
      setPhone("");
      setRecipientName("");
      setContent("");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (id: string) => refreshSmsStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
    },
  });

  const credits = creditsData?.credits ?? 0;
  const messages = messagesData?.data ?? [];
  const transactions = transactionsData?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Credit Balance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Credits SMS
          </CardTitle>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold">{credits}</span>
          <span className="ml-2 text-muted-foreground">
            credit{credits !== 1 ? "s" : ""} disponible{credits !== 1 ? "s" : ""}
          </span>
        </CardContent>
      </Card>

      {/* Send SMS Form */}
      <Card>
        <CardHeader>
          <CardTitle>Envoyer un SMS</CardTitle>
          <CardDescription>
            Envoyez un SMS a un client (1 credit par SMS)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sms-phone">Telephone</Label>
                <Input
                  id="sms-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+33612345678"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-name">Nom (optionnel)</Label>
                <Input
                  id="sms-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Nom du destinataire"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sms-content">Message</Label>
              <Textarea
                id="sms-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Votre commande est prete..."
                maxLength={160}
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground text-right">
                {content.length}/160 caracteres
              </p>
            </div>
            <Button
              type="submit"
              disabled={
                credits < 1 ||
                !phone ||
                !content ||
                sendMutation.isPending
              }
            >
              {sendMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Envoyer
            </Button>
            {sendMutation.isError && (
              <p className="text-sm text-destructive">
                {sendMutation.error?.message || "Erreur lors de l'envoi"}
              </p>
            )}
            {sendMutation.isSuccess && (
              <p className="text-sm text-green-600">SMS envoye avec succes</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Message History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des messages</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucun message envoye
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg: SmsMessage) => (
                  <TableRow key={msg.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(msg.sentAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {msg.recipientName ? (
                        <div>
                          <div className="font-medium">{msg.recipientName}</div>
                          <div className="text-muted-foreground text-xs">
                            {msg.recipientPhone}
                          </div>
                        </div>
                      ) : (
                        msg.recipientPhone
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-50 truncate">
                      {msg.content}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SMS_STATUS_VARIANT[msg.status] ?? "secondary"}>
                        {SMS_STATUS_LABELS[msg.status] ?? msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {msg.status === "sent" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => refreshMutation.mutate(msg.id)}
                          disabled={refreshMutation.isPending}
                        >
                          <RefreshCw className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Credit History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des credits</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucune transaction
            </p>
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
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${tx.amount > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-50 truncate">
                      {tx.description}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Settings Page ───────────────────────────────

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
      <div className="max-w-2xl">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">
              <Settings className="mr-2 h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="mr-2 h-4 w-4" />
              SMS
            </TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-4">
            <GeneralTab />
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            <SmsTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
