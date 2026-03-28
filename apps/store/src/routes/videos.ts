import { Hono } from "hono";
import { getImage } from "../lib/storage.js";

const videos = new Hono();

videos.get("/*", async (c) => {
  const key = c.req.path.replace("/api/videos/", "");
  if (!key) {
    return c.json({ error: "Missing video key" }, 400);
  }

  try {
    const response = await getImage(key);
    if (!response.Body) return c.notFound();

    const bytes = await response.Body.transformToByteArray();
    const buffer = new Uint8Array(bytes.buffer as ArrayBuffer);

    return c.body(buffer, 200, {
      "Content-Type": response.ContentType || "video/mp4",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    });
  } catch {
    return c.notFound();
  }
});

export default videos;
