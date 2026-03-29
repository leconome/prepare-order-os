import { Hono } from "hono";
import { uploadProductImage, uploadProductVideo } from "../lib/storage.js";
import { authMiddleware } from "../middleware/auth.js";
import { ownerOrAdmin } from "../middleware/role-guard.js";
import type { AppEnv } from "../types.js";

const uploads = new Hono<AppEnv>();

uploads.use("*", authMiddleware);

uploads.post("/product-image", ownerOrAdmin, async (c) => {
  const tenantId = c.get("tenantId") as string;

  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided. Send a 'file' field." }, 400);
  }

  try {
    const result = await uploadProductImage(tenantId, file);
    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return c.json({ error: message }, 400);
  }
});

uploads.post("/product-video", ownerOrAdmin, async (c) => {
  try {
    const tenantId = c.get("tenantId") as string;

    console.log("[video-upload] parsing body...");
    const body = await c.req.parseBody();
    const file = body.file;
    console.log("[video-upload] file:", file ? `type=${(file as File).type} size=${((file as File).size / 1024 / 1024).toFixed(1)}MB` : "null");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "No file provided. Send a 'file' field." }, 400);
    }

    const result = await uploadProductVideo(tenantId, file);
    return c.json(result, 201);
  } catch (error) {
    console.error("[video-upload] CRASH:", error);
    const message = error instanceof Error ? error.message : "Upload failed";
    return c.json({ error: message }, 500);
  }
});

export default uploads;
