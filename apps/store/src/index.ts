import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { tenantMiddleware } from "./middleware/tenant.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import categories from "./routes/categories.js";
import clientsRoutes from "./routes/clients.js";
import devRoutes from "./routes/dev.js";
import docsRoutes from "./routes/docs.js";
import emailRoutes from "./routes/email.js";
import health from "./routes/health.js";
import images from "./routes/images.js";
import menus from "./routes/menus.js";
import orders from "./routes/orders.js";
import pointsOfSaleRoutes from "./routes/points-of-sale.js";
import products from "./routes/products.js";
import smsRoutes from "./routes/sms.js";
import tenantsRoutes from "./routes/tenants.js";
import uploads from "./routes/uploads.js";
import usersRoutes from "./routes/users.js";

const app = new Hono();

// Middleware
app.use("*", logger());

const baseDomain = process.env.BASE_DOMAIN || "localhost";
const corsOrigins = process.env.CORS_ORIGINS?.split(",") || [
  "http://localhost:3000",
  "http://localhost:3002",
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow explicit origins
      if (corsOrigins.includes(origin)) return origin;
      // Allow wildcard subdomains of baseDomain (e.g. *.prepareos.fr, *.localhost)
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith(`.${baseDomain}`)) return origin;
      } catch {
        // invalid origin, ignore
      }
      return corsOrigins[0];
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Staff-PIN"],
  }),
);

// Public routes — no tenant middleware needed
app.route("/api/health", health);
app.route("/api/images", images);
app.route("/api/docs", docsRoutes);

// Auth routes — no tenant needed (Better Auth handles email/password globally)
app.route("/api/auth", authRoutes);

// Admin routes — no tenant middleware (cross-tenant)
app.route("/api/admin", adminRoutes);

// Dev routes — only in development (no tenant middleware, no auth)
if (process.env.NODE_ENV !== "production") {
  app.route("/api/dev", devRoutes);
}

// Tenant middleware — all routes below are tenant-scoped
app.use("/api/*", tenantMiddleware);
app.route("/api/orders", orders);
app.route("/api/products", products);
app.route("/api/categories", categories);
app.route("/api/menus", menus);
app.route("/api/users", usersRoutes);
app.route("/api/clients", clientsRoutes);
app.route("/api/tenants", tenantsRoutes);
app.route("/api/sms", smsRoutes);
app.route("/api/email", emailRoutes);
app.route("/api/points-of-sale", pointsOfSaleRoutes);
app.route("/api/uploads", uploads);

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
    500,
  );
});

const port = Number(process.env.PORT) || 9000;

console.log(`Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
