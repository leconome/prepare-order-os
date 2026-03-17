"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Mail, Send } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  fetchBroadcasts,
  fetchEmailMessages,
  fetchTenantSettings,
  formatDate,
  renderBroadcastEmail,
  sendBroadcastEmail,
} from "@/lib/api";
import { EMAIL_STATUS_LABELS, EMAIL_STATUS_VARIANT } from "../constants";

export function EmailTab() {
  const queryClient = useQueryClient();
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [expandedBroadcast, setExpandedBroadcast] = useState<string | null>(
    null,
  );

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const { data: messagesData } = useQuery({
    queryKey: ["email-messages"],
    queryFn: () => fetchEmailMessages({ limit: 20 }),
  });

  const { data: broadcastsData } = useQuery({
    queryKey: ["email-broadcasts"],
    queryFn: () => fetchBroadcasts({ limit: 20 }),
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const { html } = await renderBroadcastEmail({
        shopName: tenant?.name ?? "",
        content: broadcastContent,
      });
      return sendBroadcastEmail({
        subject: broadcastSubject,
        html,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-broadcasts"] });
      setBroadcastSubject("");
      setBroadcastContent("");
      setPreviewHtml("");
      setConfirmOpen(false);
    },
  });

  const handlePreviewAndConfirm = async () => {
    try {
      const { html } = await renderBroadcastEmail({
        shopName: tenant?.name ?? "",
        content: broadcastContent,
      });
      setPreviewHtml(html);
    } catch {
      setPreviewHtml("");
    }
    setConfirmOpen(true);
  };

  const messages = messagesData?.data ?? [];
  const broadcasts = broadcastsData?.data ?? [];

  return (
    <div className="space-y-2">
      {/* Broadcast Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Envoyer un email a tous les clients
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Sujet</label>
            <Input
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              placeholder="Sujet de l'email..."
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Message</label>
            <Textarea
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              placeholder="Ecrivez votre message ici..."
              rows={6}
              className="mt-1"
            />
          </div>
          <Button
            onClick={handlePreviewAndConfirm}
            disabled={!broadcastSubject.trim() || !broadcastContent.trim()}
          >
            <Mail className="mr-2 h-4 w-4" />
            Apercu et envoi
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation dialog with preview */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmer l'envoi</DialogTitle>
            <DialogDescription>
              Cet email sera envoye a tous les clients ayant une adresse email.
              Cette action est irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Sujet : {broadcastSubject}</p>
            </div>
            {previewHtml && (
              <div>
                <label className="text-sm font-medium">Apercu</label>
                <div
                  className="mt-1 p-3 border rounded-md text-sm max-h-60 overflow-y-auto bg-muted/50"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: server-rendered email preview
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
            )}
            {broadcastMutation.isError && (
              <p className="text-sm text-destructive">
                {broadcastMutation.error?.message || "Erreur lors de l'envoi"}
              </p>
            )}
            {broadcastMutation.isSuccess && (
              <p className="text-sm text-green-600">
                Envoi termine — {broadcastMutation.data.sent}/
                {broadcastMutation.data.total} envoye(s)
                {broadcastMutation.data.failed > 0 && (
                  <span className="text-destructive">
                    , {broadcastMutation.data.failed} echoue(s)
                  </span>
                )}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => broadcastMutation.mutate()}
                disabled={broadcastMutation.isPending}
              >
                {broadcastMutation.isPending
                  ? "Envoi en cours..."
                  : "Confirmer l'envoi"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcasts History */}
      <Card>
        <CardHeader>
          <CardTitle>Diffusions</CardTitle>
        </CardHeader>
        <CardContent>
          {broadcasts.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucune diffusion envoyee
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Envoyes</TableHead>
                  <TableHead>Echoues</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {broadcasts.map((b) => (
                  <>
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedBroadcast(
                          expandedBroadcast === b.id ? null : b.id,
                        )
                      }
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(b.sentAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium max-w-48 truncate">
                        {b.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default">
                          {b.sent}/{b.totalRecipients}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {b.failed > 0 ? (
                          <Badge variant="destructive">{b.failed}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {expandedBroadcast === b.id ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedBroadcast === b.id && (
                      <TableRow key={`${b.id}-preview`}>
                        <TableCell colSpan={5} className="p-0">
                          <div
                            className="p-4 bg-muted/30 border-t text-sm max-h-60 overflow-y-auto"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: stored email preview
                            dangerouslySetInnerHTML={{ __html: b.html }}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Individual Emails (order-ready) */}
      <Card>
        <CardHeader>
          <CardTitle>Emails individuels</CardTitle>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              Aucun email envoye
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Destinataire</TableHead>
                  <TableHead>Sujet</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(msg.sentAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {msg.recipientName ? (
                        <div>
                          <div className="font-medium">{msg.recipientName}</div>
                          <div className="text-muted-foreground text-xs">
                            {msg.recipientEmail}
                          </div>
                        </div>
                      ) : (
                        msg.recipientEmail
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-40 truncate">
                      {msg.subject}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          EMAIL_STATUS_VARIANT[msg.status] ?? "secondary"
                        }
                      >
                        {EMAIL_STATUS_LABELS[msg.status] ?? msg.status}
                      </Badge>
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
