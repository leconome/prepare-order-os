"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createCategorySchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
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
import { Switch } from "@/components/ui/switch";
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
  type Category,
  type CreateCategory,
  createCategory,
  fetchCategories,
} from "@/lib/api";

function CategoriesTable({ categories }: { categories: Category[] }) {
  if (categories.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucune catégorie trouvée
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Ordre</TableHead>
          <TableHead>Statut</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow
            key={category.id}
            className="cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <TableCell className="font-medium">
              <Link
                href={`/categories/${category.id}`}
                className="block w-full hover:text-primary"
              >
                {category.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[300px] truncate text-muted-foreground">
              <Link href={`/categories/${category.id}`} className="block w-full">
                {category.description || "-"}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/categories/${category.id}`} className="block w-full">
                {category.sortOrder}
              </Link>
            </TableCell>
            <TableCell>
              <Link href={`/categories/${category.id}`} className="block w-full">
                <Badge variant={category.isActive ? "active" : "inactive"}>
                  {category.isActive ? "Active" : "Inactive"}
                </Badge>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CategoriesTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 100 }),
  });

  const form = useForm({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      parentId: undefined,
      isActive: true,
      sortOrder: 0,
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: CreateCategory) => createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createCategoryMutation.mutate(data as CreateCategory);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle catégorie
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nouvelle catégorie</DialogTitle>
          <DialogDescription>
            Créez une nouvelle catégorie pour organiser vos produits.
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
                        {categoriesData?.data.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
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
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={createCategoryMutation.isPending}>
                {createCategoryMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
            {createCategoryMutation.isError && (
              <p className="text-sm text-destructive">
                Erreur: {(createCategoryMutation.error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function CategoriesPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetchCategories({ limit: 50 }),
  });

  return (
    <DashboardLayout
      title="Catégories"
      description="Organisez vos produits par catégories"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {data?.pagination.total ?? 0} catégories au total
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
            <CreateCategoryDialog />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des catégories</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <CategoriesTableSkeleton />
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
              <CategoriesTable categories={data?.data ?? []} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
