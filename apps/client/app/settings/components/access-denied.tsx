"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";

export function AccessDenied() {
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
        <Button onClick={() => router.push("/")}>Retour a l'accueil</Button>
      </div>
    </DashboardLayout>
  );
}
