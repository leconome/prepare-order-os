import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import categories from "./routes/categories.js";
import clientsRoutes from "./routes/clients.js";
import health from "./routes/health.js";
import images from "./routes/images.js";
import menus from "./routes/menus.js";
import orders from "./routes/orders.js";
import products from "./routes/products.js";
import tenantsRoutes from "./routes/tenants.js";
import smsRoutes from "./routes/sms.js";
import uploads from "./routes/uploads.js";
import usersRoutes from "./routes/users.js";
import pointsOfSaleRoutes from "./routes/points-of-sale.js";
import docsRoutes from "./routes/docs.js";
import { tenants } from "@prepareos/data";
import { inArray } from "drizzle-orm";
import { db } from "./db/index.js";
import { tenantMiddleware } from "./middleware/tenant.js";

const app = new Hono();

// Middleware
app.use("*", logger());

const baseDomain = process.env.BASE_DOMAIN;
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
      // Allow wildcard subdomains of baseDomain (e.g. *.prepareos.com)
      if (baseDomain) {
        try {
          const url = new URL(origin);
          if (url.hostname.endsWith(`.${baseDomain}`)) return origin;
        } catch {
          // invalid origin, ignore
        }
      }
      return corsOrigins[0];
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Staff-PIN", "X-Dev-Tenant"],
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

// Dev-only: list available tenants (no auth, no tenant middleware)
if (process.env.STAGE === "dev") {
  app.get("/api/dev/tenants", async (c) => {
    const slugs = (process.env.DEV_TENANT_SLUGS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (slugs.length === 0) {
      return c.json({ tenants: [] });
    }
    const rows = await db
      .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
      .from(tenants)
      .where(inArray(tenants.slug, slugs));
    // Keep the order from the env var
    const sorted = slugs
      .map((s) => rows.find((r) => r.slug === s))
      .filter(Boolean);
    return c.json({ tenants: sorted });
  });
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
