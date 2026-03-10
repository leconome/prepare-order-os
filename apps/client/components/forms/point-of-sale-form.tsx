"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createPointOfSaleSchema, updatePointOfSaleSchema } from "@prepareos/data";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type CreatePointOfSale,
  type PointOfSale,
  type UpdatePointOfSale,
  createPointOfSale,
  deletePointOfSale,
  updatePointOfSale,
} from "@/lib/api";

interface PointOfSaleFormProps {
  initialData?: PointOfSale;
}

export function PointOfSaleForm({ initialData }: PointOfSaleFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;

  const form = useForm({
    resolver: zodResolver(isEditMode ? updatePointOfSaleSchema : createPointOfSaleSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      type: initialData?.type ?? "pickup_location",
      description: initialData?.description ?? "",
      address: initialData?.address ?? "",
      phone: initialData?.phone ?? "",
      sortOrder: initialData?.sortOrder ?? 0,
      isActive: initialData?.isActive ?? true,
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        type: initialData.type,
        description: initialData.description ?? "",
        address: initialData.address ?? "",
        phone: initialData.phone ?? "",
        sortOrder: initialData.sortOrder,
        isActive: initialData.isActive,
      });
    }
  }, [initialData, form]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePointOfSale) => createPointOfSale(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-of-sale"] });
      router.push("/points-of-sale");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePointOfSale) => updatePointOfSale(initialData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-of-sale"] });
      queryClient.invalidateQueries({ queryKey: ["point-of-sale", initialData!.id] });
      router.push("/points-of-sale");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePointOfSale(initialData!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["points-of-sale"] });
      router.push("/points-of-sale");
    },
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDeleteClick = () => {
    if (!initialData) return;
    setShowDeleteDialog(true);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  const onSubmit = form.handleSubmit((data) => {
    if (isEditMode) {
      updateMutation.mutate(data as UpdatePointOfSale);
    } else {
      createMutation.mutate(data as CreatePointOfSale);
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Modifier le point de retrait" : "Nouveau point de retrait"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input placeholder="Nom du point de retrait" {...field} />
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
                      <SelectItem value="pickup_location">Point de retrait</SelectItem>
                      <SelectItem value="permanent_pos">Point de retrait permanent</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Description du point de retrait..."
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Adresse du point de retrait..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Numéro de téléphone"
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
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordre d'affichage</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Actif</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Le point de retrait sera visible et disponible
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between pt-4">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteClick}
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
                Supprimer le point de retrait
              </DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir supprimer ce point de retrait ? Cette
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
