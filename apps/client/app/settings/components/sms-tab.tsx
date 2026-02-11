"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchSmsCredits,
  fetchSmsMessages,
  fetchSmsTransactions,
  formatDate,
  refreshSmsStatus,
  type SmsMessage,
  sendSms,
} from "@/lib/api";
import {
  SMS_STATUS_LABELS,
  SMS_STATUS_VARIANT,
  TX_TYPE_LABELS,
} from "../constants";

export function SmsTab() {
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
    <div className="space-y-2">
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
            credit{credits !== 1 ? "s" : ""} disponible
            {credits !== 1 ? "s" : ""}
          </span>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Historique</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="messages">
            <TabsList className="w-full">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="credits">Credits</TabsTrigger>
            </TabsList>
            <TabsContent value="messages">
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
                              <div className="font-medium">
                                {msg.recipientName}
                              </div>
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
                          <Badge
                            variant={
                              SMS_STATUS_VARIANT[msg.status] ?? "secondary"
                            }
                          >
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
            </TabsContent>
            <TabsContent value="credits">
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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
