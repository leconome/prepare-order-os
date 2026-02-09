import { Hono } from "hono";
import { getImage } from "../lib/storage.js";

const images = new Hono();

images.get("/*", async (c) => {
  const key = c.req.path.replace("/api/images/", "");
  if (!key) {
    return c.json({ error: "Missing image key" }, 400);
  }

  try {
    const response = await getImage(key);
    if (!response.Body) return c.notFound();

    const bytes = await response.Body.transformToByteArray();

    return c.body(bytes, 200, {
      "Content-Type": response.ContentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  } catch {
    return c.notFound();
  }
});

export default images;
