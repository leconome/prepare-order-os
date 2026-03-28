"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  parseQty,
  UNIT_CONFIG,
  updateProductSchema,
} from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { GalleryUpload } from "@/components/gallery-upload";
import { ImageUpload } from "@/components/image-upload";
import { VideoUpload } from "@/components/video-upload";
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
  type CreateProduct,
  createProduct,
  deleteProduct,
  fetchCategories,
  type ProductWithVariants,
  type UpdateProduct,
  updateProduct,
  upsertVariants,
} from "@/lib/api";

interface VariantRow {
  id?: string;
  name: string;
  price: string;
  stock: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface ProductFormProps {
  initialData?: ProductWithVariants;
}

export function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;

  const [hasVariants, setHasVariants] = useState(
    () => !!initialData?.variants && initialData.variants.length > 0,
  );
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        stock: v.stock != null ? Number(v.stock) : null,
        isActive: v.isActive,
        sortOrder: v.sortOrder,
      }));
    }
    return [];
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(
      isEditMode ? updateProductSchema : createProductSchema,
    ),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      price: initialData?.price ?? "",
      categoryId: initialData?.categoryId ?? undefined,
      imageUrl: initialData?.imageUrl ?? "",
      galleryUrls: initialData?.galleryUrls ?? [],
      videoUrl: initialData?.videoUrl ?? "",
      stock:
        initialData?.stock != null ? parseQty(initialData.stock) : undefined,
      unitType: initialData?.unitType ?? "piece",
      defaultQty:
        initialData?.defaultQty != null
          ? parseQty(initialData.defaultQty)
          : undefined,
      isActive: initialData?.isActive ?? true,
      sortOrder: initialData?.sortOrder ?? 0,
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        description: initialData.description ?? "",
        price: initialData.price,
        categoryId: initialData.categoryId ?? undefined,
        imageUrl: initialData.imageUrl ?? "",
        galleryUrls: initialData.galleryUrls ?? [],
        videoUrl: initialData.videoUrl ?? "",
        stock:
          initialData.stock != null ? parseQty(initialData.stock) : undefined,
        unitType: initialData.unitType ?? "piece",
        defaultQty:
          initialData.defaultQty != null
            ? parseQty(initialData.defaultQty)
            : undefined,
        isActive: initialData.isActive,
        sortOrder: initialData.sortOrder,
      });
      if (initialData.variants && initialData.variants.length > 0) {
        setHasVariants(true);
        setVariantRows(
          initialData.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: v.price,
            stock: v.stock != null ? Number(v.stock) : null,
            isActive: v.isActive,
            sortOrder: v.sortOrder,
          })),
        );
      }
    }
  }, [initialData, form]);

  const createMutation = useMutation({
    mutationFn: (data: CreateProduct) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/products");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProduct) => {
      if (!initialData) throw new Error("No product to update");
      return updateProduct(initialData.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["product", initialData?.id] });
      router.push("/products");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!initialData) throw new Error("No product to delete");
      return deleteProduct(initialData.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/products");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;
  const watchedUnit = form.watch("unitType") || "piece";
  const unitConfig = UNIT_CONFIG[watchedUnit as keyof typeof UNIT_CONFIG];

  // --- Variant helpers ---
  function addVariantRow() {
    setVariantRows((prev) => [
      ...prev,
      {
        name: "",
        price: "",
        stock: null,
        isActive: true,
        sortOrder: prev.length,
      },
    ]);
  }

  function removeVariantRow(index: number) {
    setVariantRows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVariantRow(
    index: number,
    field: keyof VariantRow,
    value: string | number | null | boolean,
  ) {
    setVariantRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync(data as UpdateProduct);
        if (hasVariants && variantRows.length > 0) {
          await upsertVariants(initialData?.id, variantRows);
        } else if (!hasVariants) {
          // Clear all variants when toggle is off
          await upsertVariants(initialData?.id, []);
        }
        queryClient.invalidateQueries({ queryKey: ["products"] });
        queryClient.invalidateQueries({
          queryKey: ["product", initialData?.id],
        });
        router.push("/products");
      } else {
        const created = await createMutation.mutateAsync(data as CreateProduct);
        if (hasVariants && variantRows.length > 0) {
          await upsertVariants(created.id, variantRows);
        }
        queryClient.invalidateQueries({ queryKey: ["products"] });
        router.push("/products");
      }
    } catch {
      // Error is handled by mutation state
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isEditMode ? "Modifier le produit" : "Nouveau produit"}
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
                    <Input placeholder="Nom du produit" {...field} />
                  </FormControl>
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
                      placeholder="Description du produit..."
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Variants toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Variantes</p>
                <p className="text-sm text-muted-foreground">
                  Ce produit a plusieurs variantes (tailles, couleurs...)
                </p>
              </div>
              <Switch
                checked={hasVariants}
                onCheckedChange={(checked) => {
                  setHasVariants(checked);
                  if (checked && variantRows.length === 0) {
                    addVariantRow();
                  }
                }}
              />
            </div>

            {/* Product-level price & stock — hidden when hasVariants is ON */}
            {!hasVariants && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stock</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Non suivi"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            field.onChange(val === "" ? null : Number(val));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unitType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unité</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "piece"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="piece">
                            Pièce (à l'unité)
                          </SelectItem>
                          <SelectItem value="kg">
                            Kilogramme (au poids)
                          </SelectItem>
                          <SelectItem value="litre">
                            Litre (au volume)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {!hasVariants && (
              <FormField
                control={form.control}
                name="defaultQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité par défaut</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={unitConfig.step}
                        placeholder={String(unitConfig.defaultQty)}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === "" ? null : Number(val));
                        }}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Quantité ajoutée au panier par défaut (
                      {unitConfig.defaultQty} {unitConfig.suffix || "unité"} si
                      vide)
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              {!hasVariants && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix (€{unitConfig.priceSuffix})</FormLabel>
                      <FormControl>
                        <Input placeholder="10.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem className={hasVariants ? "col-span-2" : ""}>
                    <FormLabel>Catégorie</FormLabel>
                    <Select
                      onValueChange={(value) =>
                        field.onChange(value === "none" ? undefined : value)
                      }
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choisir..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucune</SelectItem>
                        {categoriesData?.data.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.color && (
                              <span
                                className="mr-2 inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                            )}
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Variant rows */}
            {hasVariants && (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm font-medium">
                  Variantes ({variantRows.length})
                </p>
                {variantRows.map((row, index) => (
                  <div
                    key={row.id ?? `new-${index}`}
                    className="flex items-end gap-2"
                  >
                    <div className="flex-1">
                      {index === 0 && (
                        <p className="mb-1 text-xs text-muted-foreground">
                          Nom
                        </p>
                      )}
                      <Input
                        placeholder="Ex: Petit, Grand..."
                        value={row.name}
                        onChange={(e) =>
                          updateVariantRow(index, "name", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-28">
                      {index === 0 && (
                        <p className="mb-1 text-xs text-muted-foreground">
                          Prix (€)
                        </p>
                      )}
                      <Input
                        placeholder="0.00"
                        value={row.price}
                        onChange={(e) =>
                          updateVariantRow(index, "price", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-24">
                      {index === 0 && (
                        <p className="mb-1 text-xs text-muted-foreground">
                          Stock
                        </p>
                      )}
                      <Input
                        type="number"
                        placeholder="—"
                        value={row.stock ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateVariantRow(
                            index,
                            "stock",
                            val === "" ? null : Number(val),
                          );
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariantRow(index)}
                      className="shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariantRow}
                  className="mt-2"
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Ajouter une variante
                </Button>
              </div>
            )}

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image principale (optionnel)</FormLabel>
                  <FormControl>
                    <ImageUpload
                      value={field.value || null}
                      onChange={(url) => field.onChange(url || "")}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="galleryUrls"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Galerie photos (optionnel)</FormLabel>
                  <FormControl>
                    <GalleryUpload
                      value={field.value ?? []}
                      onChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="videoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vidéo du produit (optionnel)</FormLabel>
                  <FormControl>
                    <VideoUpload
                      value={field.value || null}
                      onChange={(url) => field.onChange(url || "")}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEditMode && (
              <>
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
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Actif</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Le produit sera visible dans le catalogue
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
              </>
            )}

            <div className="flex items-center justify-between pt-4">
              {isEditMode ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (
                      confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")
                    ) {
                      deleteMutation.mutate();
                    }
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
              ) : (
                <div />
              )}

              <Button type="submit" disabled={isPending}>
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
      </CardContent>
    </Card>
  );
}
