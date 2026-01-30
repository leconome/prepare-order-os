"use client";

import { Badge } from "@/components/ui/badge";
import type { Tenant } from "@/lib/api";

interface StatusBadgeProps {
  status: Tenant["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config: Record<Tenant["status"], { variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    provisioning: { variant: "warning", label: "Provisioning" },
    running: { variant: "success", label: "Running" },
    stopped: { variant: "secondary", label: "Stopped" },
    failed: { variant: "destructive", label: "Failed" },
    terminating: { variant: "warning", label: "Terminating" },
    terminated: { variant: "destructive", label: "Terminated" },
  };

  const { variant, label } = config[status] || { variant: "secondary", label: status };

  return <Badge variant={variant}>{label}</Badge>;
}
