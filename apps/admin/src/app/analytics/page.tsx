"use client";

import { Activity } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AnalyticsPage() {
	return (
		<div>
			<Header title="Analytics" />
			<div className="p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5" />
							Cross-Tenant Analytics
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="py-12 text-center text-zinc-500">
							<Activity className="mx-auto mb-4 h-12 w-12" />
							<p className="text-lg font-medium">Coming Soon</p>
							<p className="mt-2">
								Cross-tenant analytics will be available in Phase 4 of the
								platform development.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
