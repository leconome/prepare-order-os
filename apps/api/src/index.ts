import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import tenantsRoutes from "./routes/tenants.js";
import healthRoutes from "./routes/health.js";
import imagesRoutes from "./routes/images.js";

const app = new Hono();

// Middleware
app.use("*", logger());

// CORS configuration - allow both local and production origins
const DOMAIN = process.env.DOMAIN || "localhost";
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://admin.localhost",
];

// Add production origins if DOMAIN is set
if (DOMAIN && DOMAIN !== "localhost") {
  allowedOrigins.push(`https://admin.${DOMAIN}`);
  allowedOrigins.push(`https://${DOMAIN}`);
}

app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Routes
app.route("/tenants", tenantsRoutes);
app.route("/health", healthRoutes);
app.route("/images", imagesRoutes);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "Econome Platform API",
    version: "1.0.0",
    endpoints: {
      tenants: "/tenants",
      images: "/images",
      health: "/health",
    },
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env.PORT || "3001", 10);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Provisioning API running on http://localhost:${info.port}`);
  }
);
