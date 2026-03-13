"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ClientForm } from "@/components/forms/client-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchClient } from "@/lib/api";

export default function ClientEditPage() {
  const params = useParams();
  const clientId = params.id as string;

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: () => fetchClient(clientId),
  });

  if (isLoading) {
    return (
      <DashboardLayout title="Chargement..." description="">
        <div className="space-y-4 max-w-2xl">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout title="Client non trouvé" description="">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Ce client n&apos;existe pas.</p>
          <Button asChild className="mt-4">
            <Link href="/clients">Retour aux clients</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={client.name}
      description="Modifier les informations du client"
    >
      <div className="space-y-4 max-w-2xl">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/clients">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour aux clients
            </Link>
          </Button>
          <Badge
            variant={client.type === "professionnel" ? "default" : "secondary"}
          >
            {client.type === "professionnel" ? "Pro" : "Particulier"}
          </Badge>
        </div>

        <ClientForm initialData={client} />
      </div>
    </DashboardLayout>
  );
}
