"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { updateCategorySchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type UpdateCategory,
  deleteCategory,
  fetchCategories,
  fetchCategory,
  updateCategory,
} from "@/lib/api";

export default function CategoryEditPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const categoryId = params.id as string;

  const { data: category, isLoading } = useQuery({
    queryKey: ["category", categoryId],
    queryFn: () => fetchCategory(categoryId),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(updateCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: undefined as string | undefined,
      isActive: true,
      sortOrder: 0,
    },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        description: category.description || "",
        parentId: category.parentId || undefined,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
      });
    }
  }, [category, form]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateCategory) => updateCategory(categoryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category", categoryId] });
      router.push("/categories");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCategory(categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      router.push("/categories");
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(data as UpdateCategory);
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement..." description="">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!category) {
    return (
      <DashboardLayout title="Catégorie non trouvée" description="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Cette catégorie n'existe pas.</p>
          <Button asChild className="mt-4">
            <Link href="/categories">Retour aux catégories</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // Filter out current category from parent options
  const availableParents = categoriesData?.data.filter(
    (c) => c.id !== categoryId
  );

  return (
    <DashboardLayout
      title={category.name}
      description="Modifier les informations de la catégorie"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/categories">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <Badge variant={category.isActive ? "active" : "inactive"}>
            {category.isActive ? "Active" : "Inactive"}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Informations de la catégorie</CardTitle>
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
                        <Input placeholder="Nom de la catégorie" {...field} />
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
                          placeholder="Description de la catégorie..."
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
                    name="parentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catégorie parente</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === "none" ? undefined : value)
                          }
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Aucune" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Aucune</SelectItem>
                            {availableParents?.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
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
                        <FormLabel>Active</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          La catégorie sera visible dans le catalogue
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
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Êtes-vous sûr de vouloir supprimer cette catégorie ?"
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
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Enregistrer
                  </Button>
                </div>
                {updateMutation.isError && (
                  <p className="text-sm text-destructive">
                    Erreur: {(updateMutation.error as Error).message}
                  </p>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
