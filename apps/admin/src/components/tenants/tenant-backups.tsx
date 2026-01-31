"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, type Backup } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import {
  Download,
  Trash2,
  RotateCcw,
  Plus,
  Shield,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle,
  HardDrive,
} from "lucide-react";

interface TenantBackupsProps {
  tenantSlug: string;
  tenantStatus: string;
}

export function TenantBackups({ tenantSlug, tenantStatus }: TenantBackupsProps) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchBackups = async () => {
    try {
      const res = await api.listBackups(tenantSlug);
      setBackups(res.backups);
    } catch (err) {
      console.error("Failed to fetch backups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, [tenantSlug]);

  const handleCreateBackup = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      await api.createBackup(tenantSlug);
      setSuccess("Backup created successfully");
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    if (!confirm(`Are you sure you want to restore from "${filename}"?\n\nThis will OVERWRITE all current data.`)) {
      return;
    }

    setRestoring(filename);
    setError(null);
    setSuccess(null);

    try {
      await api.restoreBackup(tenantSlug, filename);
      setSuccess("Backup restored successfully. The tenant may take a minute to restart.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?\n\nThis cannot be undone.`)) {
      return;
    }

    setDeleting(filename);
    setError(null);

    try {
      await api.deleteBackup(filename);
      await fetchBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete backup");
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const canCreateBackup = tenantStatus === "running";
  const canRestore = tenantStatus === "running" || tenantStatus === "stopped";

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-green-900">Data Security Status</h4>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span>PostgreSQL data persisted to volume</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span>Redis AOF persistence enabled</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span>Tenant network isolation</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-800">
                {backups.length > 0 ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>{backups.length} backup(s) available</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-700">No backups yet - create one below</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Database Backups</h4>
          <p className="text-sm text-zinc-500">
            Create and manage PostgreSQL database backups
          </p>
        </div>
        <Button
          onClick={handleCreateBackup}
          disabled={creating || !canCreateBackup}
          className="gap-2"
        >
          {creating ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Create Backup
        </Button>
      </div>

      {!canCreateBackup && (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Tenant must be running to create backups
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Backup List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        </div>
      ) : backups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center">
          <Database className="mx-auto h-10 w-10 text-zinc-400" />
          <p className="mt-2 text-zinc-500">No backups yet</p>
          <p className="text-sm text-zinc-400">
            Create your first backup to protect your data
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <div
              key={backup.filename}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-blue-100 p-2">
                  <HardDrive className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{backup.filename}</p>
                  <div className="flex items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(backup.createdAt)}
                    </span>
                    <span>{formatBytes(backup.size)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={api.getBackupDownloadUrl(backup.filename)}
                  download
                  className="inline-flex items-center"
                >
                  <Button variant="ghost" size="sm" title="Download">
                    <Download className="h-4 w-4" />
                  </Button>
                </a>

                <Button
                  variant="ghost"
                  size="sm"
                  title="Restore"
                  onClick={() => handleRestore(backup.filename)}
                  disabled={restoring === backup.filename || !canRestore}
                >
                  {restoring === backup.filename ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete"
                  onClick={() => handleDelete(backup.filename)}
                  disabled={deleting === backup.filename}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  {deleting === backup.filename ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Backup Info */}
      <div className="rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
        <h5 className="font-medium text-zinc-900">Backup Information</h5>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Backups contain the full PostgreSQL database</li>
          <li>Automated daily backups run at 2:00 AM server time</li>
          <li>Backups are retained for 7 days by default</li>
          <li>Restoring a backup will stop Medusa, replace all data, and restart</li>
        </ul>
      </div>
    </div>
  );
}
