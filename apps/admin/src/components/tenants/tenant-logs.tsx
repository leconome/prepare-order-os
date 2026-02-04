"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface TenantLogsProps {
	tenantId: string;
}

export function TenantLogs({ tenantId }: TenantLogsProps) {
	const [logs, setLogs] = useState<string>("");
	const [service, setService] = useState<"store" | "postgres" | "client">(
		"store",
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchLogs = async () => {
		setLoading(true);
		setError(null);
		try {
			const { logs: logData } = await api.getTenantLogs(tenantId, service, 200);
			setLogs(logData);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch logs");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchLogs();
	}, [tenantId, service, fetchLogs]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex gap-2">
					{(["store", "postgres", "client"] as const).map((s) => (
						<Button
							key={s}
							size="sm"
							variant={service === s ? "default" : "outline"}
							onClick={() => setService(s)}
						>
							{s.charAt(0).toUpperCase() + s.slice(1)}
						</Button>
					))}
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={fetchLogs}
					disabled={loading}
				>
					<RefreshCw
						className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			{error && (
				<div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
					{error}
				</div>
			)}

			<div className="relative">
				<pre className="max-h-[500px] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs text-zinc-100">
					{logs || "No logs available"}
				</pre>
			</div>
		</div>
	);
}
