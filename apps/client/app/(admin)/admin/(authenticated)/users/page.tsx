"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createAdminSchema, updateAdminSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
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
  type AdminUser,
  createAdminUser,
  fetchAdminUsers,
  formatDate,
  toggleAdminActive,
  updateAdminUser,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ============ CREATE ADMIN DIALOG ============

function CreateAdminDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createAdminSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const mutation = useMutation({
    mutationFn: createAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un admin
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouvel administrateur</DialogTitle>
          <DialogDescription>
            Créez un nouveau compte administrateur plateforme.
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

// ============ EDIT ADMIN DIALOG ============

function EditAdminDialog({
  admin,
  open,
  onOpenChange,
}: {
  admin: AdminUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(updateAdminSchema),
    defaultValues: {
      name: admin.name || "",
      email: admin.email,
    },
  });

  useEffect(() => {
    form.reset({
      name: admin.name || "",
      email: admin.email,
    });
  }, [admin]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      updateAdminUser(admin.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      onOpenChange(false);
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier l'administrateur</DialogTitle>
          <DialogDescription>
            Modifiez les informations de {admin.name || admin.email}
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
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {(mutation.error as Error).message || "Erreur"}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ MAIN PAGE ============

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
  });

  const toggleMutation = useMutation({
    mutationFn: toggleAdminActive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const admins = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administrateurs</h1>
          <p className="text-muted-foreground">
            Gestion des comptes administrateurs de la plateforme
          </p>
        </div>
        <CreateAdminDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comptes administrateurs</CardTitle>
          <CardDescription>
            Les administrateurs ont accès à toutes les fonctionnalités de la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-muted-foreground">
              Erreur lors du chargement des administrateurs
            </div>
          ) : admins.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun administrateur trouvé
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
                {admins.map((admin) => {
                  const isSelf = currentUser?.id === admin.id;
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          {admin.name || "-"}
                          {isSelf && (
                            <Badge variant="outline" className="text-xs">
                              vous
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.isActive ? "active" : "inactive"}>
                          {admin.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(admin.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingAdmin(admin)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Êtes-vous sûr de vouloir ${admin.isActive ? "désactiver" : "réactiver"} cet administrateur ?`)) {
                                toggleMutation.mutate(admin.id);
                              }
                            }}
                            disabled={isSelf || toggleMutation.isPending}
                            title={isSelf ? "Vous ne pouvez pas vous désactiver vous-même" : undefined}
                          >
                            {admin.isActive ? "Désactiver" : "Réactiver"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingAdmin && (
        <EditAdminDialog
          admin={editingAdmin}
          open={!!editingAdmin}
          onOpenChange={(open) => !open && setEditingAdmin(null)}
        />
      )}
    </div>
  );
}
