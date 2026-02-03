import { zValidator } from "@hono/zod-validator";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/index.js";
import { platformImages } from "../db/schema.js";
import { apiKeyAuth } from "../middleware/auth.js";

const images = new Hono();

// Apply API key auth to mutation endpoints (POST, PATCH, DELETE)
images.use("*", async (c, next) => {
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

// GET /images - List all available Medusa versions
images.get("/", async (c) => {
	try {
		const allImages = await db
			.select()
			.from(platformImages)
			.orderBy(desc(platformImages.createdAt));
		return c.json({ images: allImages });
	} catch (error) {
		console.error("Error listing images:", error);
		return c.json({ error: "Failed to list images" }, 500);
	}
});

// GET /images/latest - Get the latest stable version
images.get("/latest", async (c) => {
	try {
		const [latestImage] = await db
			.select()
			.from(platformImages)
			.where(eq(platformImages.isLatest, true))
			.limit(1);

		if (!latestImage) {
			// Fall back to most recent non-deprecated image
			const [mostRecent] = await db
				.select()
				.from(platformImages)
				.where(eq(platformImages.isDeprecated, false))
				.orderBy(desc(platformImages.createdAt))
				.limit(1);

			if (!mostRecent) {
				return c.json({ error: "No images available" }, 404);
			}
			return c.json({ image: mostRecent });
		}

		return c.json({ image: latestImage });
	} catch (error) {
		console.error("Error getting latest image:", error);
		return c.json({ error: "Failed to get latest image" }, 500);
	}
});

// POST /images - Register a new image version (called by CI/CD)
images.post("/", zValidator("json", createImageSchema), async (c) => {
	try {
		const input = c.req.valid("json");

		// Check if version already exists
		const [existing] = await db
			.select()
			.from(platformImages)
			.where(eq(platformImages.version, input.version))
			.limit(1);

		if (existing) {
			return c.json({ error: "Version already exists" }, 409);
		}

		// If this is marked as latest, unset any existing latest
		if (input.isLatest) {
			await db
				.update(platformImages)
				.set({ isLatest: false })
				.where(eq(platformImages.isLatest, true));
		}

		const [image] = await db
			.insert(platformImages)
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
		console.error("Error creating image:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to create image",
			},
			500,
		);
	}
});

// PATCH /images/:version - Update image metadata (deprecate, set latest)
images.patch("/:version", zValidator("json", updateImageSchema), async (c) => {
	try {
		const version = c.req.param("version");
		const updates = c.req.valid("json");

		// Check if image exists
		const [existing] = await db
			.select()
			.from(platformImages)
			.where(eq(platformImages.version, version))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Image not found" }, 404);
		}

		// If setting as latest, unset any existing latest
		if (updates.isLatest) {
			await db
				.update(platformImages)
				.set({ isLatest: false })
				.where(eq(platformImages.isLatest, true));
		}

		const [image] = await db
			.update(platformImages)
			.set(updates)
			.where(eq(platformImages.version, version))
			.returning();

		return c.json({ image });
	} catch (error) {
		console.error("Error updating image:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to update image",
			},
			500,
		);
	}
});

// DELETE /images/:version - Remove a version from registry
images.delete("/:version", async (c) => {
	try {
		const version = c.req.param("version");

		// Check if image exists
		const [existing] = await db
			.select()
			.from(platformImages)
			.where(eq(platformImages.version, version))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Image not found" }, 404);
		}

		await db.delete(platformImages).where(eq(platformImages.version, version));

		return c.json({ success: true });
	} catch (error) {
		console.error("Error deleting image:", error);
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to delete image",
			},
			500,
		);
	}
});

export default images;
