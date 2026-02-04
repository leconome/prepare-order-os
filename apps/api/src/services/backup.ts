import { exec } from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import * as dockerService from "./docker.js";

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || "/opt/econome/backups";

export interface BackupInfo {
	filename: string;
	tenantSlug: string;
	createdAt: Date;
	size: number;
}

/**
 * Create a backup of a tenant's PostgreSQL database
 */
export async function createBackup(tenantSlug: string): Promise<BackupInfo> {
	const containerName = `tenant_${tenantSlug}_postgres`;
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const filename = `${tenantSlug}_${timestamp}.sql.gz`;
	const backupPath = path.join(BACKUP_DIR, filename);

	// Ensure backup directory exists
	await fs.mkdir(BACKUP_DIR, { recursive: true });

	// Get database credentials from container
	const dbName = `store_${tenantSlug}`;
	const dbUser = `store_${tenantSlug}`;

	// Create backup using pg_dump
	const command = `docker exec ${containerName} pg_dump -U ${dbUser} -d ${dbName} --no-owner --no-acl | gzip > ${backupPath}`;

	try {
		await execAsync(command, { timeout: 300000 }); // 5 minute timeout

		const stats = await fs.stat(backupPath);

		return {
			filename,
			tenantSlug,
			createdAt: new Date(),
			size: stats.size,
		};
	} catch (error) {
		// Clean up failed backup file
		await fs.unlink(backupPath).catch(() => {});
		throw new Error(
			`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * List all backups for a tenant
 */
export async function listBackups(tenantSlug?: string): Promise<BackupInfo[]> {
	try {
		await fs.mkdir(BACKUP_DIR, { recursive: true });
		const files = await fs.readdir(BACKUP_DIR);

		const backups: BackupInfo[] = [];

		for (const file of files) {
			if (!file.endsWith(".sql.gz")) continue;

			// Parse filename: tenantSlug_timestamp.sql.gz
			const match = file.match(
				/^(.+?)_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}.*?)\.sql\.gz$/,
			);
			if (!match) continue;

			const [, slug, _timestampStr] = match;

			// Filter by tenant if specified
			if (tenantSlug && slug !== tenantSlug) continue;

			const filePath = path.join(BACKUP_DIR, file);
			const stats = await fs.stat(filePath);

			backups.push({
				filename: file,
				tenantSlug: slug,
				createdAt: stats.mtime,
				size: stats.size,
			});
		}

		// Sort by date, newest first
		return backups.sort(
			(a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return [];
		}
		throw error;
	}
}

/**
 * Restore a tenant's database from a backup
 */
export async function restoreBackup(
	tenantSlug: string,
	filename: string,
): Promise<void> {
	const containerName = `tenant_${tenantSlug}_postgres`;
	const storeContainer = `tenant_${tenantSlug}_store`;
	const backupPath = path.join(BACKUP_DIR, filename);

	// Verify backup exists
	try {
		await fs.access(backupPath);
	} catch {
		throw new Error(`Backup file not found: ${filename}`);
	}

	// Verify container is running
	const status = await dockerService.getContainerStatus(containerName);
	if (status !== "running") {
		throw new Error(`PostgreSQL container is not running: ${status}`);
	}

	const dbName = `store_${tenantSlug}`;
	const dbUser = `store_${tenantSlug}`;

	// Stop Store to prevent connections during restore
	try {
		await execAsync(`docker stop ${storeContainer}`, { timeout: 30000 });
	} catch {
		// Container might not be running
	}

	try {
		// Drop and recreate database
		await execAsync(
			`docker exec ${containerName} psql -U ${dbUser} -d postgres -c "DROP DATABASE IF EXISTS ${dbName};"`,
			{ timeout: 30000 },
		);
		await execAsync(
			`docker exec ${containerName} psql -U ${dbUser} -d postgres -c "CREATE DATABASE ${dbName} OWNER ${dbUser};"`,
			{ timeout: 30000 },
		);

		// Restore from backup
		await execAsync(
			`gunzip -c ${backupPath} | docker exec -i ${containerName} psql -U ${dbUser} -d ${dbName} --quiet`,
			{ timeout: 600000 }, // 10 minute timeout for large databases
		);

		// Restart Store
		await execAsync(`docker start ${storeContainer}`, { timeout: 30000 });
	} catch (error) {
		// Try to restart Store even if restore failed
		await execAsync(`docker start ${storeContainer}`).catch(() => {});
		throw new Error(
			`Failed to restore backup: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Delete a backup file
 */
export async function deleteBackup(filename: string): Promise<void> {
	const backupPath = path.join(BACKUP_DIR, filename);

	// Validate filename to prevent path traversal
	if (filename.includes("/") || filename.includes("..")) {
		throw new Error("Invalid filename");
	}

	await fs.unlink(backupPath);
}

/**
 * Get backup file for download
 */
export async function getBackupPath(filename: string): Promise<string> {
	// Validate filename to prevent path traversal
	if (filename.includes("/") || filename.includes("..")) {
		throw new Error("Invalid filename");
	}

	const backupPath = path.join(BACKUP_DIR, filename);

	try {
		await fs.access(backupPath);
		return backupPath;
	} catch {
		throw new Error(`Backup file not found: ${filename}`);
	}
}
