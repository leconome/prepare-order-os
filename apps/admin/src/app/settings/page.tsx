"use client";

import { Settings } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
	return (
		<div>
			<Header title="Settings" />
			<div className="p-6">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings className="h-5 w-5" />
							Platform Settings
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="py-12 text-center text-zinc-500">
							<Settings className="mx-auto mb-4 h-12 w-12" />
							<p className="text-lg font-medium">Coming Soon</p>
							<p className="mt-2">
								Platform configuration and settings will be available in Phase
								5.
							</p>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
