"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createStaffSchema, updateStaffSchema } from "@prepareos/data";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type CreateStaff,
  type StaffUser,
  type UpdateStaff,
  createStaff,
  deleteStaff,
  fetchStaff,
  formatDate,
  updateStaff,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ROLE_CONFIG = {
  admin: {
    label: "Admin",
    icon: ShieldCheck,
    color: "bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800",
  },
  owner: {
    label: "Proprietaire",
    icon: Shield,
    color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800",
  },
  staff: {
    label: "Employe",
    icon: User,
    color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800",
  },
};

// ============ CREATE STAFF DIALOG ============

function CreateStaffDialog() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(createStaffSchema),
    defaultValues: {
      name: "",
      email: "",
      pin: "",
      role: "staff" as const,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      setOpen(false);
      form.reset();
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data as CreateStaff);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700">
          <Plus className="mr-2 h-4 w-4" />
          Nouvel employe
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajouter un employe</DialogTitle>
          <DialogDescription>
            Creez un nouveau membre de l'equipe avec un code PIN pour la connexion rapide.
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
                    <Input
                      type="email"
                      placeholder="jean@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="----"
                      maxLength={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Code a 4 chiffres pour la connexion rapide
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner un role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="staff">Employe</SelectItem>
                      <SelectItem value="owner">Proprietaire</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <FormDescription>
                      Le membre pourra se connecter
                    </FormDescription>
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
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Creer
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

// ============ EDIT STAFF DIALOG ============

function EditStaffDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(updateStaffSchema),
    defaultValues: {
      name: staff.name || "",
      pin: "",
      role: staff.role as "admin" | "owner" | "staff",
      isActive: staff.isActive,
    },
  });

  useEffect(() => {
    form.reset({
      name: staff.name || "",
      pin: "",
      role: staff.role as "admin" | "owner" | "staff",
      isActive: staff.isActive,
    });
  }, [staff, form]);

  const updateMutation = useMutation({
    mutationFn: (data: UpdateStaff) => updateStaff(staff.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStaff(staff.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    // Only include pin if it was changed
    const updateData: UpdateStaff = {
      name: data.name,
      role: data.role,
      isActive: data.isActive,
    };
    if (data.pin && data.pin.length === 4) {
      updateData.pin = data.pin;
    }
    updateMutation.mutate(updateData);
  });

  const isPending = updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier l'employe</DialogTitle>
          <DialogDescription>
            Modifiez les informations de {staff.name || staff.email}
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
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nouveau code PIN (optionnel)</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="----"
                      maxLength={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Laissez vide pour conserver le PIN actuel
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selectionner un role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="staff">Employe</SelectItem>
                      <SelectItem value="owner">Proprietaire</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <FormDescription>
                      Le membre pourra se connecter
                    </FormDescription>
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
                  if (confirm("Etes-vous sur de vouloir supprimer cet employe ?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={isPending}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Supprimer
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
                >
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </div>
            {updateMutation.isError && (
              <p className="text-sm text-destructive">
                Erreur: {(updateMutation.error as Error).message}
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ============ STAFF TABLE ============

function StaffTable({ staff }: { staff: StaffUser[] }) {
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  if (staff.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Aucun employe trouve
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Cree le</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((member) => {
            const roleConfig = ROLE_CONFIG[member.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.staff;
            const RoleIcon = roleConfig.icon;

            return (
              <TableRow key={member.id}>
                <TableCell className="font-medium">
                  {member.name || "-"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={roleConfig.color}>
                    <RoleIcon className="mr-1 h-3 w-3" />
                    {roleConfig.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={member.isActive ? "active" : "inactive"}>
                    {member.isActive ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(member.createdAt)}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingStaff(member)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {editingStaff && (
        <EditStaffDialog
          staff={editingStaff}
          open={!!editingStaff}
          onOpenChange={(open) => !open && setEditingStaff(null)}
        />
      )}
    </>
  );
}

// ============ EMPLOYEES TAB ============

function EmployeesTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchStaff({ limit: 100 }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gestion des employes</CardTitle>
            <CardDescription>
              Ajoutez, modifiez ou supprimez les membres de votre equipe
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["staff"] })}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <CreateStaffDialog />
          </div>
        </div>
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
            Erreur lors du chargement des employes
          </div>
        ) : (
          <StaffTable staff={data?.data || []} />
        )}
      </CardContent>
    </Card>
  );
}

// ============ ACCESS DENIED ============

function AccessDenied() {
  const router = useRouter();

  return (
    <DashboardLayout title="Acces refuse" description="">
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <Lock className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Acces restreint</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Cette page est reservee aux administrateurs et proprietaires.
          Contactez votre responsable si vous pensez devoir y avoir acces.
        </p>
        <Button onClick={() => router.push("/")}>
          Retour a l'accueil
        </Button>
      </div>
    </DashboardLayout>
  );
}

// ============ MAIN PAGE ============

export default function SettingsPage() {
  const { user, isLoading } = useAuth();

  // Check if user has admin or owner role
  const canAccessSettings = user?.role === "admin" || user?.role === "owner";

  if (isLoading) {
    return (
      <DashboardLayout title="Parametres" description="Chargement...">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!canAccessSettings) {
    return <AccessDenied />;
  }

  return (
    <DashboardLayout
      title="Parametres"
      description="Configurez votre application"
    >
      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList>
          <TabsTrigger value="employees" className="gap-2">
            <Users className="h-4 w-4" />
            Employes
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2" disabled>
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <EmployeesTab />
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Parametres generaux</CardTitle>
              <CardDescription>
                Configuration generale de l'application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Bientot disponible...
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
