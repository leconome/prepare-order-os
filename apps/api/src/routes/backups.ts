import * as fs from "node:fs";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import { z } from "zod";
import * as backupService from "../services/backup.js";

const backups = new Hono();

// Validation schemas
const restoreBackupSchema = z.object({
	filename: z.string().min(1),
});

// GET /backups - List all backups
backups.get("/", async (c) => {
	try {
		const tenantSlug = c.req.query("tenant");
		const allBackups = await backupService.listBackups(tenantSlug);
		return c.json({ backups: allBackups });
	} catch (error) {
		console.error("Error listing backups:", error);
		return c.json({ error: "Failed to list backups" }, 500);
	}
});

// POST /backups/:tenantSlug - Create a backup for a tenant
backups.post("/:tenantSlug", async (c) => {
	try {
		const tenantSlug = c.req.param("tenantSlug");
		const backup = await backupService.createBackup(tenantSlug);
		return c.json({ backup }, 201);
	} catch (error) {
		console.error("Error creating backup:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to create backup",
			},
			500,
		);
	}
});

// POST /backups/:tenantSlug/restore - Restore a backup
backups.post(
	"/:tenantSlug/restore",
	zValidator("json", restoreBackupSchema),
	async (c) => {
		try {
			const tenantSlug = c.req.param("tenantSlug");
			const { filename } = c.req.valid("json");

			await backupService.restoreBackup(tenantSlug, filename);
			return c.json({ success: true, message: "Backup restored successfully" });
		} catch (error) {
			console.error("Error restoring backup:", error);
			return c.json(
				{
					error:
						error instanceof Error ? error.message : "Failed to restore backup",
				},
				500,
			);
		}
	},
);

// GET /backups/download/:filename - Download a backup file
backups.get("/download/:filename", async (c) => {
	try {
		const filename = c.req.param("filename");
		const backupPath = await backupService.getBackupPath(filename);

		const stat = fs.statSync(backupPath);

		c.header("Content-Type", "application/gzip");
		c.header("Content-Disposition", `attachment; filename="${filename}"`);
		c.header("Content-Length", stat.size.toString());

		return stream(c, async (stream) => {
			const fileStream = fs.createReadStream(backupPath);
			for await (const chunk of fileStream) {
				await stream.write(chunk);
			}
		});
	} catch (error) {
		console.error("Error downloading backup:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to download backup",
			},
			404,
		);
	}
});

// DELETE /backups/:filename - Delete a backup
backups.delete("/:filename", async (c) => {
	try {
		const filename = c.req.param("filename");
		await backupService.deleteBackup(filename);
		return c.json({ success: true });
	} catch (error) {
		console.error("Error deleting backup:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to delete backup",
			},
			500,
		);
	}
});

export default backups;
