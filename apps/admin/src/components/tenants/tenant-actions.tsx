"use client";

import { Play, Rocket, RotateCcw, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api, type Tenant } from "@/lib/api";

interface TenantActionsProps {
	tenant: Tenant;
	onUpdate: () => void;
	size?: "default" | "sm";
}

export function TenantActions({
	tenant,
	onUpdate,
	size = "default",
}: TenantActionsProps) {
	const [loading, setLoading] = useState<string | null>(null);

	const handleAction = async (action: string, fn: () => Promise<unknown>) => {
		setLoading(action);
		try {
			await fn();
			onUpdate();
		} catch (error) {
			console.error(`Failed to ${action}:`, error);
			alert(
				`Failed to ${action}: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setLoading(null);
		}
	};

	const buttonSize = size === "sm" ? "sm" : "default";
	const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";

	return (
		<div className="flex items-center gap-2">
			{tenant.status === "pending" && (
				<Button
					size={buttonSize}
					onClick={() =>
						handleAction("provision", () => api.provisionTenant(tenant.id))
					}
					loading={loading === "provision"}
				>
					<Rocket className={`${iconSize} mr-1`} />
					Provision
				</Button>
			)}

			{tenant.status === "stopped" && (
				<Button
					size={buttonSize}
					variant="outline"
					onClick={() =>
						handleAction("start", () => api.startTenant(tenant.id))
					}
					loading={loading === "start"}
				>
					<Play className={`${iconSize} mr-1`} />
					Start
				</Button>
			)}

			{tenant.status === "running" && (
				<>
					<Button
						size={buttonSize}
						variant="outline"
						onClick={() =>
							handleAction("stop", () => api.stopTenant(tenant.id))
						}
						loading={loading === "stop"}
					>
						<Square className={`${iconSize} mr-1`} />
						Stop
					</Button>
					<Button
						size={buttonSize}
						variant="outline"
						onClick={() =>
							handleAction("restart", () => api.restartTenant(tenant.id))
						}
						loading={loading === "restart"}
					>
						<RotateCcw className={`${iconSize} mr-1`} />
						Restart
					</Button>
				</>
			)}

			{(tenant.status === "stopped" || tenant.status === "failed") && (
				<Button
					size={buttonSize}
					variant="destructive"
					onClick={() => {
						if (
							confirm(
								`Are you sure you want to delete ${tenant.name}? This action cannot be undone.`,
							)
						) {
							handleAction("delete", () => api.deleteTenant(tenant.id));
						}
					}}
					loading={loading === "delete"}
				>
					<Trash2 className={`${iconSize} mr-1`} />
					Delete
				</Button>
			)}

			{tenant.status === "failed" && (
				<Button
					size={buttonSize}
					onClick={() =>
						handleAction("provision", () => api.provisionTenant(tenant.id))
					}
					loading={loading === "provision"}
				>
					<Rocket className={`${iconSize} mr-1`} />
					Retry
				</Button>
			)}
		</div>
	);
}
