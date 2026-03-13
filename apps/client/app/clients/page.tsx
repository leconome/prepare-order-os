"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createClientSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Phone, Plus, RefreshCw, Search, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  type Client,
  type CreateClient,
  createClient,
  fetchClients,
  formatDate,
} from "@/lib/api";

function ClientsTable({ clients }: { clients: Client[] }) {
  const router = useRouter();

  if (clients.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucun client trouvé
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Téléphone</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead>Créé le</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow
            key={client.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => router.push(`/clients/${client.id}`)}
          >
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs text-white shrink-0">
                  {client.name[0]?.toUpperCase()}
                </div>
                {client.name}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={client.type === "professionnel" ? "default" : "secondary"}>
                {client.type === "professionnel" ? "Pro" : "Particulier"}
              </Badge>
            </TableCell>
            <TableCell>
              {client.phone ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {client.phone}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {client.email ? (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {client.email}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-muted-foreground">
              {client.notes || "-"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(client.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ClientsTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

function CreateClientDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      name: "",
      type: "particulier" as const,
      phone: "",
      email: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data as CreateClient);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Nouveau client
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>
            Ajoutez un nouveau client à votre base de données.
          </DialogDescription>
        </DialogHeader>
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
                          <SelectValue placeholder="Type" />
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
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input placeholder="06 12 34 56 78" {...field} />
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
            {createMutation.isError && (
              <p className="text-sm text-destructive">
                Erreur: {(createMutation.error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["clients", search],
    queryFn: () => fetchClients({ limit: 100, search: search || undefined }),
  });

  return (
    <DashboardLayout
      title="Clients"
      description="Gérez votre base de clients"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearch("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["clients"] })
              }
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
            <CreateClientDialog />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Liste des clients
              {data?.pagination.total !== undefined && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({data.pagination.total})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ClientsTableSkeleton />
            ) : isError ? (
              <div className="py-8 text-center text-muted-foreground">
                Erreur lors du chargement: {(error as Error).message}
              </div>
            ) : (
              <ClientsTable clients={data?.data || []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
