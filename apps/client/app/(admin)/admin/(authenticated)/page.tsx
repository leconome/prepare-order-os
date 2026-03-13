"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createTenantSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Store } from "lucide-react";
import Link from "next/link";
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
import { createTenant, fetchAllTenants, formatDate } from "@/lib/api";

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function CreateTenantDialog() {
  const [open, setOpen] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createTenantSchema),
    defaultValues: { name: "", slug: "" },
  });

  const name = form.watch("name");

  // Auto-generate slug from name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited) {
      form.setValue("slug", slugify(name));
    }
  }, [name, slugManuallyEdited, form]);

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    mutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { form.reset(); mutation.reset(); setSlugManuallyEdited(false); } }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Créer un tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouveau tenant</DialogTitle>
          <DialogDescription>
            Créez un nouveau tenant pour la plateforme.
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
                    <Input placeholder="La Fromagerie du Coin" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="la-fromagerie-du-coin"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e);
                        setSlugManuallyEdited(true);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Sous-domaine du tenant (ex: {field.value || "mon-tenant"}.prepareos.fr)
                  </FormDescription>
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

export default function AdminPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: fetchAllTenants,
  });

  const tenants = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Administration</h1>
          <p className="text-muted-foreground">Gestion de la plateforme</p>
        </div>
        <CreateTenantDialog />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>
            Liste de tous les tenants de la plateforme
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : isError ? (
            <div className="py-8 text-center text-muted-foreground">
              Erreur lors du chargement des tenants
            </div>
          ) : tenants.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun tenant trouvé
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Filtre préparation</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Store className="h-4 w-4 text-muted-foreground" />
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {tenant.slug}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenant.preparationFilterDays} jour{tenant.preparationFilterDays !== 1 ? "s" : ""}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(tenant.createdAt)}
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
