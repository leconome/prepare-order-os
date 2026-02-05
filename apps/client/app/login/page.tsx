"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkUserExists, signUpDevUser } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEFAULT_CREDENTIALS = {
  email: "admin@admin.com",
  password: "admin123",
};

const IS_DEV_STAGE = process.env.NEXT_PUBLIC_STAGE === "dev";

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { data: userCheck, isLoading: checkingUser } = useQuery({
    queryKey: ["devUserCheck", DEFAULT_CREDENTIALS.email],
    queryFn: () => checkUserExists(DEFAULT_CREDENTIALS.email),
    enabled: IS_DEV_STAGE,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      login(email, password),
    onSuccess: () => router.push("/"),
    onError: () => setError("Email ou mot de passe incorrect"),
  });

  const createDevUserMutation = useMutation({
    mutationFn: () =>
      signUpDevUser({
        email: DEFAULT_CREDENTIALS.email,
        password: DEFAULT_CREDENTIALS.password,
        name: "Admin",
        role: "admin",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devUserCheck"] });
      fillDefaultCredentials();
    },
    onError: (err) => {
      setError(
        err instanceof Error ? err.message : "Échec de la création du compte",
      );
    },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

  const fillDefaultCredentials = () => {
    setEmail(DEFAULT_CREDENTIALS.email);
    setPassword(DEFAULT_CREDENTIALS.password);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const userExists = userCheck?.exists ?? null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Caisse</CardTitle>
          <CardDescription>
            Connectez-vous pour accéder à votre caisse
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Dev credentials section */}
          {IS_DEV_STAGE && (
            <div className="rounded-lg border border-dashed p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Identifiants par défaut
                </span>
                {checkingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : userExists === true ? (
                  <Badge
                    variant="default"
                    className="bg-green-500 hover:bg-green-600"
                  >
                    Utilisateur existe
                  </Badge>
                ) : userExists === false ? (
                  <Badge variant="destructive">Utilisateur inexistant</Badge>
                ) : (
                  <Badge variant="secondary">Statut inconnu</Badge>
                )}
              </div>
              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">Email:</span>{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    {DEFAULT_CREDENTIALS.email}
                  </code>
                </p>
                <p>
                  <span className="text-muted-foreground">Mot de passe:</span>{" "}
                  <code className="rounded bg-muted px-1 py-0.5">
                    {DEFAULT_CREDENTIALS.password}
                  </code>
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={fillDefaultCredentials}
              >
                Utiliser ces identifiants
              </Button>
              {userExists === false && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => createDevUserMutation.mutate()}
                  disabled={createDevUserMutation.isPending}
                >
                  {createDevUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    "Créer l'utilisateur dev"
                  )}
                </Button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loginMutation.isPending}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
