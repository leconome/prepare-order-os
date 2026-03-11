"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  parseQty,
  updateProductSchema,
  UNIT_CONFIG,
  type AttributeTerm,
  type ProductVariant,
  type StockMode,
} from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { ImageUpload } from "@/components/image-upload";
import { Badge } from "@/components/ui/badge";
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
  type Product,
  type UpdateProduct,
  createAttributeTerm,
  createProduct,
  createVariant,
  deleteProduct,
  deleteVariant,
  fetchAttributes,
  fetchCategories,
  fetchVariants,
  updateProduct,
  updateVariant,
} from "@/lib/api";

interface ProductFormProps {
  initialData?: Product & { variants?: ProductVariant[] };
}

export function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEditMode = !!initialData;

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  // Variant state
  const hasExistingVariants = (initialData?.variants ?? []).length > 0;
  const [hasVariants, setHasVariants] = useState(
    !!initialData?.stockMode || hasExistingVariants,
  );
  const [stockMode, setStockMode] = useState<StockMode>(
    initialData?.stockMode ?? "individual",
  );
  const [variants, setVariants] = useState<ProductVariant[]>(
    initialData?.variants ?? [],
  );
  const [newVariant, setNewVariant] = useState<{
    name: string;
    price: string;
    stock: string;
    capacity: string;
  } | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<{
    name: string;
    price: string;
    stock: string;
    capacity: string;
  } | null>(null);
  const [variantSaving, setVariantSaving] = useState(false);

  // Attributes
  const { data: attributes } = useQuery({
    queryKey: ["attributes"],
    queryFn: fetchAttributes,
    enabled: isEditMode && hasVariants,
  });
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(
    initialData?.attributeId ?? null,
  );
  const [newTermName, setNewTermName] = useState("");
  const [showNewTerm, setShowNewTerm] = useState(false);

  const selectedAttribute = attributes?.find(
    (a) => a.id === selectedAttributeId,
  );
  const usedTermIds = new Set(
    variants
      .filter((v) => v.attributeTermId)
      .map((v) => v.attributeTermId as string),
  );

  const form = useForm({
    resolver: zodResolver(isEditMode ? updateProductSchema : createProductSchema),
    defaultValues: {
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      price: initialData?.price ?? "",
      categoryId: initialData?.categoryId ?? undefined,
      imageUrl: initialData?.imageUrl ?? "",
      stock:
        initialData?.stock != null ? parseQty(initialData.stock) : undefined,
      unitType: initialData?.unitType ?? "piece",
      defaultQty:
        initialData?.defaultQty != null
          ? parseQty(initialData.defaultQty)
          : undefined,
      stockMode: initialData?.stockMode ?? null,
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
        stock:
          initialData.stock != null ? parseQty(initialData.stock) : undefined,
        unitType: initialData.unitType ?? "piece",
        defaultQty:
          initialData.defaultQty != null
            ? parseQty(initialData.defaultQty)
            : undefined,
        stockMode: initialData.stockMode ?? null,
        isActive: initialData.isActive,
        sortOrder: initialData.sortOrder,
      });
      const existingVariants = initialData.variants ?? [];
      const shouldHaveVariants =
        !!initialData.stockMode || existingVariants.length > 0;
      setHasVariants(shouldHaveVariants);
      setStockMode(initialData.stockMode ?? "individual");
      setVariants(existingVariants);
      setSelectedAttributeId(initialData.attributeId ?? null);
      // Auto-fix: if variants exist but stockMode is null, save it
      if (existingVariants.length > 0 && !initialData.stockMode) {
        updateProduct(initialData.id, { stockMode: "individual" });
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
    mutationFn: (data: UpdateProduct) => updateProduct(initialData!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({
        queryKey: ["product", initialData!.id],
      });
      router.push("/products");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProduct(initialData!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      router.push("/products");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;
  const watchedUnit = form.watch("unitType") || "piece";
  const unitConfig = UNIT_CONFIG[watchedUnit as keyof typeof UNIT_CONFIG];

  const onSubmit = form.handleSubmit((data) => {
    const payload = {
      ...data,
      stockMode: hasVariants ? stockMode : null,
    };
    if (isEditMode) {
      updateMutation.mutate(payload as UpdateProduct);
    } else {
      createMutation.mutate(payload as CreateProduct);
    }
  });

  const refreshVariants = async () => {
    if (!initialData) return;
    const data = await fetchVariants(initialData.id);
    setVariants(data);
  };

  const handleAddVariant = async () => {
    if (!newVariant || !initialData) return;
    setVariantSaving(true);
    try {
      await createVariant(initialData.id, {
        name: newVariant.name,
        price: newVariant.price,
        stock:
          stockMode === "individual" && newVariant.stock
            ? Number(newVariant.stock)
            : null,
        capacity:
          stockMode === "shared" && newVariant.capacity
            ? Number(newVariant.capacity)
            : undefined,
      });
      setNewVariant(null);
      await refreshVariants();
    } finally {
      setVariantSaving(false);
    }
  };

  const handleUpdateVariant = async (variantId: string) => {
    if (!editingVariant || !initialData) return;
    setVariantSaving(true);
    try {
      await updateVariant(initialData.id, variantId, {
        name: editingVariant.name,
        price: editingVariant.price,
        stock:
          stockMode === "individual" && editingVariant.stock
            ? Number(editingVariant.stock)
            : stockMode === "individual"
              ? null
              : undefined,
        capacity:
          stockMode === "shared" && editingVariant.capacity
            ? Number(editingVariant.capacity)
            : undefined,
      });
      setEditingVariantId(null);
      setEditingVariant(null);
      await refreshVariants();
    } finally {
      setVariantSaving(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!initialData) return;
    if (!confirm("Supprimer cette variante ?")) return;
    await deleteVariant(initialData.id, variantId);
    await refreshVariants();
  };

  const handleAttributeChange = (attrId: string | null) => {
    setSelectedAttributeId(attrId);
    if (initialData) {
      updateProduct(initialData.id, { attributeId: attrId });
    }
  };

  const handleAddFromTerm = async (term: AttributeTerm) => {
    if (!initialData) return;
    setVariantSaving(true);
    try {
      await createVariant(initialData.id, {
        name: term.name,
        attributeTermId: term.id,
        price: "0",
      });
      await refreshVariants();
    } finally {
      setVariantSaving(false);
    }
  };

  const handleAddNewTermAndVariant = async () => {
    if (!selectedAttributeId || !newTermName.trim() || !initialData) return;
    setVariantSaving(true);
    try {
      const term = await createAttributeTerm(selectedAttributeId, {
        name: newTermName.trim(),
      });
      await createVariant(initialData.id, {
        name: term.name,
        attributeTermId: term.id,
        price: "0",
      });
      setNewTermName("");
      setShowNewTerm(false);
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      await refreshVariants();
    } finally {
      setVariantSaving(false);
    }
  };

  const showPrice = !hasVariants;
  const showStock =
    !hasVariants || (hasVariants && stockMode === "shared");
  const stockLabel = hasVariants && stockMode === "shared" ? "Stock global" : "Stock";
  const inputStep = unitConfig.integerStock ? "1" : "any";

  return (
    <div className="space-y-4">
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

              <div className="grid grid-cols-2 gap-4">
                {showStock && (
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{stockLabel}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step={inputStep}
                            min="0"
                            placeholder="Non suivi"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                field.onChange(null);
                              } else {
                                const num = Number(val);
                                field.onChange(
                                  unitConfig.integerStock ? Math.round(num) : num,
                                );
                              }
                            }}
                            onBlur={() => {
                              field.onBlur();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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

              <FormField
                control={form.control}
                name="defaultQty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité par défaut</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step={inputStep}
                        min={inputStep}
                        placeholder={String(unitConfig.defaultQty)}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            field.onChange(null);
                          } else {
                            const num = Number(val);
                            field.onChange(
                              unitConfig.integerStock ? Math.round(num) : num,
                            );
                          }
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

              <div className="grid grid-cols-2 gap-4">
                {showPrice && (
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Prix (€{unitConfig.priceSuffix})
                        </FormLabel>
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
                    <FormItem>
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

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image du produit (optionnel)</FormLabel>
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

              <div className="flex items-center justify-between pt-4">
                {isEditMode ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Êtes-vous sûr de vouloir supprimer ce produit ?",
                        )
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
        </CardContent>
      </Card>

      {/* Variants section — only in edit mode */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Variantes</CardTitle>
              <Switch
                checked={hasVariants}
                onCheckedChange={(checked) => {
                  setHasVariants(checked);
                  if (!checked) {
                    // Clear stockMode on the product
                    updateProduct(initialData!.id, { stockMode: null });
                  } else {
                    updateProduct(initialData!.id, { stockMode });
                  }
                }}
              />
            </div>
            {!hasVariants && (
              <p className="text-sm text-muted-foreground">
                Activez les variantes pour créer des déclinaisons (tailles,
                couleurs...)
              </p>
            )}
          </CardHeader>

          {hasVariants && (
            <CardContent className="space-y-4">
              {/* Stock mode selector */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Mode de stock :</span>
                <div className="flex rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setStockMode("individual");
                      updateProduct(initialData!.id, {
                        stockMode: "individual",
                      });
                    }}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      stockMode === "individual"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    Individuel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStockMode("shared");
                      updateProduct(initialData!.id, { stockMode: "shared" });
                    }}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      stockMode === "shared"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    Partagé
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stockMode === "individual"
                  ? "Chaque variante a son propre stock."
                  : "Stock global partagé entre les variantes (ex : 15L de glace)."}
              </p>

              {/* Attribute selector */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Attribut :</span>
                <Select
                  value={selectedAttributeId ?? "none"}
                  onValueChange={(val) =>
                    handleAttributeChange(val === "none" ? null : val)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Texte libre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Texte libre</SelectItem>
                    {attributes?.map((attr) => (
                      <SelectItem key={attr.id} value={attr.id}>
                        {attr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Variant list */}
              {variants.length > 0 && (
                <div className="space-y-2">
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center gap-2 rounded-lg border p-3"
                    >
                      {editingVariantId === v.id && editingVariant ? (
                        <>
                          <Input
                            value={editingVariant.name}
                            onChange={(e) =>
                              setEditingVariant({
                                ...editingVariant,
                                name: e.target.value,
                              })
                            }
                            className="h-8 flex-1"
                            placeholder="Nom"
                          />
                          <Input
                            value={editingVariant.price}
                            onChange={(e) =>
                              setEditingVariant({
                                ...editingVariant,
                                price: e.target.value,
                              })
                            }
                            className="h-8 w-20"
                            placeholder="Prix"
                          />
                          {stockMode === "individual" && (
                            <Input
                              type="number"
                              step={inputStep}
                              min="0"
                              value={editingVariant.stock}
                              onChange={(e) =>
                                setEditingVariant({
                                  ...editingVariant,
                                  stock: e.target.value,
                                })
                              }
                              className="h-8 w-20"
                              placeholder="Stock"
                            />
                          )}
                          {stockMode === "shared" && (
                            <Input
                              type="number"
                              step={inputStep}
                              min="0"
                              value={editingVariant.capacity}
                              onChange={(e) =>
                                setEditingVariant({
                                  ...editingVariant,
                                  capacity: e.target.value,
                                })
                              }
                              className="h-8 w-20"
                              placeholder="Capacité"
                            />
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={variantSaving}
                            onClick={() => handleUpdateVariant(v.id)}
                          >
                            {variantSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "OK"
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingVariantId(null);
                              setEditingVariant(null);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="font-medium flex-1">{v.name}</span>
                          <Badge variant="outline">{v.price} €</Badge>
                          {stockMode === "individual" && v.stock !== null && (
                            <Badge variant="secondary">
                              Stock: {v.stock}
                            </Badge>
                          )}
                          {stockMode === "shared" && (
                            <Badge variant="secondary">
                              {v.capacity}
                              {unitConfig.suffix
                                ? ` ${unitConfig.suffix}`
                                : "x"}
                            </Badge>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingVariantId(v.id);
                              setEditingVariant({
                                name: v.name,
                                price: v.price,
                                stock: v.stock ?? "",
                                capacity: v.capacity,
                              });
                            }}
                          >
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteVariant(v.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add variant — attribute terms or free text */}
              {selectedAttribute ? (
                <div className="space-y-2">
                  <span className="text-sm font-medium">
                    Ajouter des variantes ({selectedAttribute.name}) :
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {selectedAttribute.terms.map((term) => {
                      const isUsed = usedTermIds.has(term.id);
                      return (
                        <button
                          key={term.id}
                          type="button"
                          disabled={isUsed || variantSaving}
                          onClick={() => handleAddFromTerm(term)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border transition-colors ${
                            isUsed
                              ? "bg-primary/10 text-primary border-primary/30 cursor-default"
                              : "hover:bg-muted border-border cursor-pointer"
                          }`}
                        >
                          {isUsed && <Check className="h-3 w-3" />}
                          {term.name}
                        </button>
                      );
                    })}
                    {/* Add new term inline */}
                    {showNewTerm ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          value={newTermName}
                          onChange={(e) => setNewTermName(e.target.value)}
                          className="h-8 w-32 text-sm"
                          placeholder="Nouveau terme..."
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTermName.trim()) {
                              e.preventDefault();
                              handleAddNewTermAndVariant();
                            }
                            if (e.key === "Escape") {
                              setShowNewTerm(false);
                              setNewTermName("");
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={
                            !newTermName.trim() || variantSaving
                          }
                          onClick={handleAddNewTermAndVariant}
                        >
                          {variantSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setShowNewTerm(false);
                            setNewTermName("");
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowNewTerm(true)}
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm border border-dashed text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        Nouveau terme
                      </button>
                    )}
                  </div>
                </div>
              ) : newVariant ? (
                <div className="flex items-center gap-2 rounded-lg border border-dashed p-3">
                  <Input
                    value={newVariant.name}
                    onChange={(e) =>
                      setNewVariant({ ...newVariant, name: e.target.value })
                    }
                    className="h-8 flex-1"
                    placeholder="Nom (ex: 250ml, Bleu)"
                    autoFocus
                  />
                  <Input
                    value={newVariant.price}
                    onChange={(e) =>
                      setNewVariant({ ...newVariant, price: e.target.value })
                    }
                    className="h-8 w-20"
                    placeholder="Prix"
                  />
                  {stockMode === "individual" && (
                    <Input
                      type="number"
                      step={inputStep}
                      min="0"
                      value={newVariant.stock}
                      onChange={(e) =>
                        setNewVariant({ ...newVariant, stock: e.target.value })
                      }
                      className="h-8 w-20"
                      placeholder="Stock"
                    />
                  )}
                  {stockMode === "shared" && (
                    <Input
                      type="number"
                      step={inputStep}
                      min="0"
                      value={newVariant.capacity}
                      onChange={(e) =>
                        setNewVariant({
                          ...newVariant,
                          capacity: e.target.value,
                        })
                      }
                      className="h-8 w-20"
                      placeholder="Capacité"
                    />
                  )}
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      variantSaving || !newVariant.name || !newVariant.price
                    }
                    onClick={handleAddVariant}
                  >
                    {variantSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Ajouter"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewVariant(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewVariant({
                      name: "",
                      price: "",
                      stock: "",
                      capacity: "1",
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter une variante
                </Button>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
