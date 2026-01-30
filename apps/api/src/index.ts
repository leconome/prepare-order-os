import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import tenantsRoutes from "./routes/tenants.js";
import healthRoutes from "./routes/health.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://admin.localhost",
    ],
    credentials: true,
  })
);

// Routes
app.route("/tenants", tenantsRoutes);
app.route("/health", healthRoutes);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    name: "Econome Platform API",
    version: "1.0.0",
    endpoints: {
      tenants: "/tenants",
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
