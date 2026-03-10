"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSchema, updateClientSchema } from "@prepareos/data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type Client,
  type CreateClient,
  type UpdateClient,
  createClient,
  deleteClient,
  updateClient,
} from "@/lib/api";

interface ClientFormProps {
  initialData?: Client;
}

export function ClientForm({ initialData }: ClientFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;

  const form = useForm({
    resolver: zodResolver(isEditMode ? updateClientSchema : createClientSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      type: initialData?.type ?? "particulier",
      phone: initialData?.phone ?? "",
      email: initialData?.email ?? "",
      notes: initialData?.notes ?? "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        type: initialData.type ?? "particulier",
        phone: initialData.phone ?? "",
        email: initialData.email ?? "",
        notes: initialData.notes ?? "",
      });
    }
  }, [initialData, form]);

  const createMutation = useMutation({
    mutationFn: (data: CreateClient) => createClient(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/clients");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateClient) => updateClient(initialData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", initialData!.id] });
      router.push("/clients");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClient(initialData!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      router.push("/clients");
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const onSubmit = form.handleSubmit((data) => {
    if (isEditMode) {
      updateMutation.mutate(data as UpdateClient);
    } else {
      createMutation.mutate(data as CreateClient);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Modifier le client" : "Nouveau client"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du client" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="particulier">Particulier</SelectItem>
                        <SelectItem value="professionnel">Professionnel</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="06 12 34 56 78"
                        {...field}
                        value={field.value || ""}
                      />
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
                      <Input
                        type="email"
                        placeholder="client@example.com"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notes sur ce client..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between pt-4">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Supprimer
                </Button>
              ) : (
                <div />
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {isEditMode ? "Enregistrer" : "Créer"}
              </Button>
            </div>

            {error && (
              <p className="text-sm text-destructive">
                Erreur: {(error as Error).message}
              </p>
            )}
          </form>
        </Form>

        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Supprimer le client
              </DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer ce client ? Cette
                action est irréversible.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDeleteDialog(false);
                  deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Supprimer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
