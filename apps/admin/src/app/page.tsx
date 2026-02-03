"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, Plus, Server, Store } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/tenants/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, DOMAIN } from "@/lib/api";

export default function DashboardPage() {
	const { data: tenantsData, isLoading: tenantsLoading } = useQuery({
		queryKey: ["tenants"],
		queryFn: () => Promise.all([api.listTenants(), api.getHealth()]),
		select: (data) => {
			return {
				tenants: data[0].tenants,
				health: data[1],
			};
		},
	});

	const stats = {
		total: tenantsData?.tenants?.length ?? 0,
		running:
			tenantsData?.tenants?.filter((t) => t.status === "running").length ?? 0,
		stopped:
			tenantsData?.tenants?.filter((t) => t.status === "stopped").length ?? 0,
		failed:
			tenantsData?.tenants?.filter((t) => t.status === "failed").length ?? 0,
	};

	if (tenantsLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900" />
			</div>
		);
	}

	return (
		<div>
			<Header title="Dashboard" />

			<div className="p-6">
				<div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">
								Total Tenants
							</CardTitle>
							<Store className="h-4 w-4 text-zinc-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.total}</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Running</CardTitle>
							<Activity className="h-4 w-4 text-green-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600">
								{stats.running}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">Stopped</CardTitle>
							<Server className="h-4 w-4 text-zinc-500" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-zinc-500">
								{stats.stopped}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between pb-2">
							<CardTitle className="text-sm font-medium">
								Platform Status
							</CardTitle>
							<div
								className={`h-3 w-3 rounded-full ${
									tenantsData?.health?.status === "healthy"
										? "bg-green-500"
										: "bg-yellow-500"
								}`}
							/>
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold capitalize">
								{tenantsData?.health?.status || "Unknown"}
							</div>
						</CardContent>
					</Card>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<CardTitle>Recent Tenants</CardTitle>
							<Link href="/tenants/new">
								<Button size="sm">
									<Plus className="mr-1 h-4 w-4" />
									New Tenant
								</Button>
							</Link>
						</CardHeader>
						<CardContent>
							{tenantsData?.tenants?.length === 0 ? (
								<div className="py-8 text-center text-zinc-500">
									<Store className="mx-auto mb-2 h-8 w-8" />
									<p>No tenants yet</p>
									<Link href="/tenants/new">
										<Button variant="link">Create your first tenant</Button>
									</Link>
								</div>
							) : (
								<div className="space-y-4">
									{tenantsData?.tenants?.slice(0, 5).map((tenant) => (
										<div
											key={tenant.id}
											className="flex items-center justify-between rounded-lg border p-4"
										>
											<div>
												<div className="flex items-center gap-2">
													<span className="font-medium">{tenant.name}</span>
													<StatusBadge status={tenant.status} />
												</div>
												<div className="mt-1 text-sm text-zinc-500">
													{tenant.subdomain}.{DOMAIN}
												</div>
											</div>
											<Link href={`/tenants/${tenant.id}`}>
												<Button variant="ghost" size="sm">
													<ArrowRight className="h-4 w-4" />
												</Button>
											</Link>
										</div>
									))}
									{tenantsData?.tenants?.length &&
										tenantsData?.tenants?.length > 5 && (
											<Link href="/tenants" className="block text-center">
												<Button variant="link">View all tenants</Button>
											</Link>
										)}
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Quick Actions</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<Link href="/tenants/new" className="block">
								<Button variant="outline" className="w-full justify-start">
									<Plus className="mr-2 h-4 w-4" />
									Create New Tenant
								</Button>
							</Link>
							<Link href="/tenants" className="block">
								<Button variant="outline" className="w-full justify-start">
									<Store className="mr-2 h-4 w-4" />
									Manage Tenants
								</Button>
							</Link>
							<Link href="/analytics" className="block">
								<Button variant="outline" className="w-full justify-start">
									<Activity className="mr-2 h-4 w-4" />
									View Analytics
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
