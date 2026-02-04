"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
  fetchOrders,
  createOrder,
  formatCurrency,
  formatDate,
  type OrderWithItems,
} from "@/lib/api";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  partially_paid: "Partiellement payé",
  refunded: "Remboursé",
};

const PREPARATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_preparation: "En préparation",
  ready: "Prêt",
  picked_up: "Récupéré",
};

function getPaymentBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default";
    case "pending":
    case "partially_paid":
      return "secondary";
    case "refunded":
      return "destructive";
    default:
      return "outline";
  }
}

function getPreparationBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ready":
    case "picked_up":
      return "default";
    case "in_preparation":
      return "secondary";
    case "pending":
      return "outline";
    default:
      return "outline";
  }
}

function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
  if (orders.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucune commande trouvée
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Ticket</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Articles</TableHead>
          <TableHead>Préparation</TableHead>
          <TableHead>Paiement</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium">#{order.ticketNumber}</TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(order.createdAt)}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {order.items?.slice(0, 2).map((item) => (
                  <span key={item.id} className="text-sm">
                    {item.quantity}x {item.productName}
                  </span>
                ))}
                {order.items && order.items.length > 2 && (
                  <span className="text-sm text-muted-foreground">
                    +{order.items.length - 2} autres
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={getPreparationBadgeVariant(order.preparationStatus)}
              >
                {PREPARATION_STATUS_LABELS[order.preparationStatus] ||
                  order.preparationStatus}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant={getPaymentBadgeVariant(order.paymentStatus)}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ||
                  order.paymentStatus}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(order.total)}
            </TableCell>
            <TableCell>
              <Link href={`/orders/${order.id}`}>
                <Button variant="ghost" size="icon">
                  <Eye className="h-4 w-4" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function OrdersTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

const createOrderSchema = z.object({
  productName: z.string().min(1, "Nom du produit requis"),
  unitPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Prix invalide"),
  quantity: z.coerce.number().int().positive("Quantité invalide"),
  clientNote: z.string().optional(),
});

type CreateOrderForm = z.infer<typeof createOrderSchema>;

function CreateOrderDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<CreateOrderForm>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      productName: "",
      unitPrice: "",
      quantity: 1,
      clientNote: "",
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: CreateOrderForm) => {
      return createOrder({
        clientNote: data.clientNote || undefined,
        items: [
          {
            productId: crypto.randomUUID(), // Temporary ID for quick order
            productName: data.productName,
            unitPrice: data.unitPrice,
            quantity: data.quantity,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = (data: CreateOrderForm) => {
    createOrderMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle commande
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nouvelle commande</DialogTitle>
          <DialogDescription>
            Créez une nouvelle commande rapide.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produit</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du produit" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix unitaire (€)</FormLabel>
                    <FormControl>
                      <Input placeholder="10.00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="clientNote"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note (optionnel)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Instructions spéciales..."
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
              <Button type="submit" disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
            {createOrderMutation.isError && (
              <p className="text-sm text-destructive">
                Erreur: {(createOrderMutation.error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function OrdersPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchOrders({ limit: 50 }),
  });

  return (
    <DashboardLayout title="Commandes" description="Gérez vos commandes">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} commandes au total
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Actualiser
            </Button>
            <CreateOrderDialog />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Commandes récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <OrdersTableSkeleton />
            ) : isError ? (
              <div className="py-12 text-center">
                <p className="text-destructive">
                  Erreur de chargement : {(error as Error).message}
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => refetch()}
                >
                  Réessayer
                </Button>
              </div>
            ) : (
              <OrdersTable orders={data?.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
