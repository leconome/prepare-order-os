import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { clientImages } from "../db/schema.js";
import { apiKeyAuth } from "../middleware/auth.js";

const clientImagesRoutes = new Hono();

// Apply API key auth to mutation endpoints (POST, PATCH, DELETE)
clientImagesRoutes.use("*", async (c, next) => {
	const method = c.req.method;
	if (method === "POST" || method === "PATCH" || method === "DELETE") {
		return apiKeyAuth(c, next);
	}
	return next();
});

// Validation schemas
const createImageSchema = z.object({
	version: z.string().min(1).max(50),
	imageTag: z.string().min(1).max(255),
	commitSha: z.string().length(40).optional(),
	releaseNotes: z.string().optional(),
	isLatest: z.boolean().optional(),
});

const updateImageSchema = z.object({
	releaseNotes: z.string().optional(),
	isLatest: z.boolean().optional(),
	isDeprecated: z.boolean().optional(),
});

// GET /images/client - List all available client versions
clientImagesRoutes.get("/", async (c) => {
	try {
		const allImages = await db
			.select()
			.from(clientImages)
			.orderBy(desc(clientImages.createdAt));
		return c.json({ images: allImages });
	} catch (error) {
		console.error("Error listing client images:", error);
		return c.json({ error: "Failed to list client images" }, 500);
	}
});

// GET /images/client/latest - Get the latest stable version
clientImagesRoutes.get("/latest", async (c) => {
	try {
		const [latestImage] = await db
			.select()
			.from(clientImages)
			.where(eq(clientImages.isLatest, true))
			.limit(1);

		if (!latestImage) {
			// Fall back to most recent non-deprecated image
			const [mostRecent] = await db
				.select()
				.from(clientImages)
				.where(eq(clientImages.isDeprecated, false))
				.orderBy(desc(clientImages.createdAt))
				.limit(1);

			if (!mostRecent) {
				return c.json({ error: "No client images available" }, 404);
			}
			return c.json({ image: mostRecent });
		}

		return c.json({ image: latestImage });
	} catch (error) {
		console.error("Error getting latest client image:", error);
		return c.json({ error: "Failed to get latest client image" }, 500);
	}
});

// POST /images/client - Register a new client image version (called by CI/CD)
clientImagesRoutes.post(
	"/",
	zValidator("json", createImageSchema),
	async (c) => {
		try {
			const input = c.req.valid("json");

			// Check if version already exists
			const [existing] = await db
				.select()
				.from(clientImages)
				.where(eq(clientImages.version, input.version))
				.limit(1);

			if (existing) {
				return c.json({ error: "Version already exists" }, 409);
			}

			// If this is marked as latest, unset any existing latest
			if (input.isLatest) {
				await db
					.update(clientImages)
					.set({ isLatest: false })
					.where(eq(clientImages.isLatest, true));
			}

			const [image] = await db
				.insert(clientImages)
				.values({
					version: input.version,
					imageTag: input.imageTag,
					commitSha: input.commitSha,
					releaseNotes: input.releaseNotes,
					isLatest: input.isLatest ?? false,
				})
				.returning();

			return c.json({ image }, 201);
		} catch (error) {
			console.error("Error creating client image:", error);
			return c.json(
				{
					error:
						error instanceof Error
							? error.message
							: "Failed to create client image",
				},
				500,
			);
		}
	},
);

// PATCH /images/client/:version - Update client image metadata
clientImagesRoutes.patch(
	"/:version",
	zValidator("json", updateImageSchema),
	async (c) => {
		try {
			const version = c.req.param("version");
			const updates = c.req.valid("json");

			// Check if image exists
			const [existing] = await db
				.select()
				.from(clientImages)
				.where(eq(clientImages.version, version))
				.limit(1);

			if (!existing) {
				return c.json({ error: "Client image not found" }, 404);
			}

			// If setting as latest, unset any existing latest
			if (updates.isLatest) {
				await db
					.update(clientImages)
					.set({ isLatest: false })
					.where(eq(clientImages.isLatest, true));
			}

			const [image] = await db
				.update(clientImages)
				.set(updates)
				.where(eq(clientImages.version, version))
				.returning();

			return c.json({ image });
		} catch (error) {
			console.error("Error updating client image:", error);
			return c.json(
				{
					error:
						error instanceof Error
							? error.message
							: "Failed to update client image",
				},
				500,
			);
		}
	},
);

// DELETE /images/client/:version - Remove a version from registry
clientImagesRoutes.delete("/:version", async (c) => {
	try {
		const version = c.req.param("version");

		// Check if image exists
		const [existing] = await db
			.select()
			.from(clientImages)
			.where(eq(clientImages.version, version))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Client image not found" }, 404);
		}

		await db.delete(clientImages).where(eq(clientImages.version, version));

		return c.json({ success: true });
	} catch (error) {
		console.error("Error deleting client image:", error);
		return c.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to delete client image",
			},
			500,
		);
	}
});

export default clientImagesRoutes;
