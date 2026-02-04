"use client";

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
import { useAuth } from "@/lib/auth";

const DEFAULT_CREDENTIALS = {
  email: "admin@admin.com",
  password: "admin123",
};

const API_URL = process.env.NEXT_PUBLIC_STORE_API_URL || "http://localhost:9000";

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [creatingUser, setCreatingUser] = useState(false);

  // Check if default user exists on mount
  useEffect(() => {
    async function checkDefaultUser() {
      try {
        const response = await fetch(
          `${API_URL}/api/users/check/${encodeURIComponent(DEFAULT_CREDENTIALS.email)}`,
          { credentials: "include" }
        );
        const data = await response.json();
        setUserExists(data.exists);
      } catch (err) {
        console.error("Failed to check user:", err);
        setUserExists(null);
      } finally {
        setCheckingUser(false);
      }
    }
    checkDefaultUser();
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError("Email ou mot de passe incorrect");
      console.error("Login failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fillDefaultCredentials = () => {
    setEmail(DEFAULT_CREDENTIALS.email);
    setPassword(DEFAULT_CREDENTIALS.password);
  };

  const createDevUser = async () => {
    setCreatingUser(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: DEFAULT_CREDENTIALS.email,
          password: DEFAULT_CREDENTIALS.password,
          name: "Admin",
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Échec de la création");
      }
      setUserExists(true);
      fillDefaultCredentials();
    } catch (err) {
      console.error("Failed to create user:", err);
      setError(err instanceof Error ? err.message : "Échec de la création du compte");
    } finally {
      setCreatingUser(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          {process.env.NODE_ENV !== "production" && (
            <div className="rounded-lg border border-dashed p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Identifiants par défaut
                </span>
                {checkingUser ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : userExists === true ? (
                  <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                    Utilisateur existe
                  </Badge>
                ) : userExists === false ? (
                  <Badge variant="destructive">
                    Utilisateur inexistant
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    Statut inconnu
                  </Badge>
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
                  onClick={createDevUser}
                  disabled={creatingUser}
                >
                  {creatingUser ? (
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
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
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
