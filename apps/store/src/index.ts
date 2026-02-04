import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import health from "./routes/health.js";
import authRoutes from "./routes/auth.js";
import orders from "./routes/orders.js";
import employees from "./routes/employees.js";
import products from "./routes/products.js";
import categories from "./routes/categories.js";
import menus from "./routes/menus.js";
import usersRoutes from "./routes/users.js";

const app = new Hono();

// Middleware
app.use("*", logger());

const corsOrigins = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:3002",
];

app.use(
  "*",
  cors({
    origin: corsOrigins,
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Employee-PIN"],
  })
);

// Routes
app.route("/api/health", health);
app.route("/api/auth", authRoutes);
app.route("/api/orders", orders);
app.route("/api/employees", employees);
app.route("/api/products", products);
app.route("/api/categories", categories);
app.route("/api/menus", menus);
app.route("/api/users", usersRoutes);

// Root route
app.get("/", (c) => {
  return c.json({
    name: "store-api",
    version: "1.0.0",
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      error: err.message || "Internal Server Error",
    },
    500
  );
});

const port = Number(process.env.PORT) || 9000;

console.log(`Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
