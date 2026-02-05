"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Delete, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  checkUserExists,
  fetchLoginStaff,
  type LoginStaffMember,
  signUpDevUser,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

const DEFAULT_CREDENTIALS = {
  email: "admin@admin.com",
  password: "admin123",
};

const IS_DEV_STAGE = process.env.NEXT_PUBLIC_STAGE === "dev";

type LoginMode = "staff" | "admin";

// ============ PIN PAD ============

function PinPad({
  pin,
  onPinChange,
  onSubmit,
  disabled,
}: {
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: (pin: string) => void;
  disabled: boolean;
}) {
  const handleDigit = useCallback(
    (digit: string) => {
      if (pin.length < 4) {
        const next = pin + digit;
        onPinChange(next);
        if (next.length === 4) {
          // Delay to show the 4th dot before submitting
          setTimeout(() => onSubmit(next), 150);
        }
      }
    },
    [pin, onPinChange, onSubmit],
  );

  const handleBackspace = useCallback(() => {
    onPinChange(pin.slice(0, -1));
  }, [pin, onPinChange]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= "0" && e.key <= "9") {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, handleDigit, handleBackspace]);

  const digits = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "",
    "0",
    "back",
  ];

  return (
    <div className="space-y-6">
      {/* PIN dots */}
      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 transition-all ${
              i < pin.length
                ? "bg-primary border-primary scale-110"
                : "border-muted-foreground/40"
            }`}
          />
        ))}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-2 max-w-65 mx-auto">
        {digits.map((d) => {
          if (d === "") return <div key="empty" />;
          if (d === "back") {
            return (
              <Button
                key="back"
                type="button"
                variant="ghost"
                className="h-14 text-lg"
                disabled={disabled || pin.length === 0}
                onClick={handleBackspace}
              >
                <Delete className="h-5 w-5" />
              </Button>
            );
          }
          return (
            <Button
              key={d}
              type="button"
              variant="outline"
              className="h-14 text-lg font-medium"
              disabled={disabled || pin.length >= 4}
              onClick={() => handleDigit(d)}
            >
              {d}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ============ STAFF GRID ============

function StaffGrid({
  staff,
  loading,
  onSelect,
}: {
  staff: LoginStaffMember[];
  loading: boolean;
  onSelect: (member: LoginStaffMember) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (staff.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Aucun employé configuré
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {staff.map((member) => {
        const initials = member.name
          ? member.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()
          : "?";

        return (
          <button
            key={member.id}
            type="button"
            onClick={() => onSelect(member)}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md cursor-pointer"
          >
            <Avatar size="lg">
              {member.image && <AvatarImage src={member.image} />}
              <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-white text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate max-w-full">
              {member.name || "Sans nom"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============ ADMIN LOGIN FORM ============

function AdminLoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { login } = useAuth();
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
    onError: (err) =>
      setError(
        err instanceof Error ? err.message : "Email ou mot de passe incorrect",
      ),
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ email, password });
  };

  const fillDefaultCredentials = () => {
    setEmail(DEFAULT_CREDENTIALS.email);
    setPassword(DEFAULT_CREDENTIALS.password);
  };

  const userExists = userCheck?.exists ?? null;

  return (
    <div className="space-y-6">
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
    </div>
  );
}

// ============ MAIN PAGE ============

export default function LoginPage() {
  const router = useRouter();
  const { loginWithPin, isAuthenticated, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<LoginMode>("staff");
  const [selectedStaff, setSelectedStaff] = useState<LoginStaffMember | null>(
    null,
  );
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ["login-staff"],
    queryFn: fetchLoginStaff,
  });

  const pinMutation = useMutation({
    mutationFn: ({ userId, pin }: { userId: string; pin: string }) =>
      loginWithPin(userId, pin),
    onSuccess: () => router.push("/"),
    onError: (err) => {
      setPin("");
      setError(err instanceof Error ? err.message : "PIN incorrect");
    },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  const handlePinSubmit = (pinValue: string) => {
    if (!selectedStaff || pinValue.length !== 4) return;
    setError("");
    pinMutation.mutate({ userId: selectedStaff.id, pin: pinValue });
  };

  const handleBack = () => {
    setSelectedStaff(null);
    setPin("");
    setError("");
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
            {mode === "staff"
              ? selectedStaff
                ? `Entrez le PIN de ${selectedStaff.name || "l'employé"}`
                : "Sélectionnez votre profil"
              : "Connexion administrateur"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {mode === "staff" ? (
            selectedStaff ? (
              /* PIN entry */
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </button>

                {/* Selected staff display */}
                <div className="flex flex-col items-center gap-2">
                  <Avatar size="lg">
                    {selectedStaff.image && (
                      <AvatarImage src={selectedStaff.image} />
                    )}
                    <AvatarFallback className="bg-linear-to-br from-blue-500 to-indigo-600 text-white text-sm">
                      {selectedStaff.name
                        ? selectedStaff.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {selectedStaff.name || "Sans nom"}
                  </span>
                </div>

                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive text-center">
                    {error}
                  </div>
                )}

                <PinPad
                  pin={pin}
                  onPinChange={setPin}
                  onSubmit={handlePinSubmit}
                  disabled={pinMutation.isPending}
                />

                {pinMutation.isPending && (
                  <div className="flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              /* Staff grid */
              <StaffGrid
                staff={staffData?.staff ?? []}
                loading={staffLoading}
                onSelect={setSelectedStaff}
              />
            )
          ) : (
            /* Admin login form */
            <AdminLoginForm />
          )}

          {/* Mode toggle */}
          <div className="text-center border-t pt-4">
            {mode === "staff" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("admin");
                  setSelectedStaff(null);
                  setPin("");
                  setError("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Connexion admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("staff");
                  setError("");
                }}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Retour au choix du personnel
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
