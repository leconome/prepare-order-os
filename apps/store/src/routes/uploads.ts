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
  const tenantId = c.get("tenantId") as string;

  const body = await c.req.parseBody();
  const file = body.file;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No file provided. Send a 'file' field." }, 400);
  }

  try {
    const result = await uploadProductVideo(tenantId, file);
    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return c.json({ error: message }, 400);
  }
});

export default uploads;
