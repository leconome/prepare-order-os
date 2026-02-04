"use client";

import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { DashboardLayout } from "@/components/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOrders, formatCurrency, type OrderWithItems } from "@/lib/api";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  loading,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentOrderItem({ order }: { order: OrderWithItems }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-medium">#{order.ticketNumber}</p>
          <p className="text-xs text-muted-foreground">
            {order.createdBy?.name || "Sans caissier"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          {order.items?.length ?? 0} articles
        </Badge>
        <span className="text-sm font-medium">
          {formatCurrency(order.total)}
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders", "dashboard"],
    queryFn: () => fetchOrders({ limit: 10 }),
  });

  const orders = data?.data ?? [];
  const totalOrders = data?.pagination?.total ?? 0;

  // Calculate stats
  const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total), 0);
  const pendingOrders = orders.filter(
    (o) => o.preparationStatus === "pending" || o.preparationStatus === "in_preparation"
  ).length;
  const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

  return (
    <DashboardLayout
      title="Tableau de bord"
      description="Bienvenue sur votre caisse"
    >
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total commandes"
            value={totalOrders.toString()}
            icon={ShoppingCart}
            description="Toutes les commandes"
            loading={isLoading}
          />
          <StatCard
            title="Chiffre d'affaires"
            value={formatCurrency(totalRevenue, "EUR")}
            icon={DollarSign}
            description="Commandes récentes"
            loading={isLoading}
          />
          <StatCard
            title="En attente"
            value={pendingOrders.toString()}
            icon={Package}
            description="À préparer"
            loading={isLoading}
          />
          <StatCard
            title="Panier moyen"
            value={formatCurrency(avgOrderValue, "EUR")}
            icon={TrendingUp}
            description="Valeur moyenne"
            loading={isLoading}
          />
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Commandes récentes</CardTitle>
            <Link href="/orders">
              <Button variant="outline" size="sm">
                Voir tout
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                Aucune commande
              </div>
            ) : (
              <div className="divide-y">
                {orders.slice(0, 5).map((order) => (
                  <RecentOrderItem key={order.id} order={order} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
