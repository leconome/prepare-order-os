import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const tenantStatusEnum = pgEnum("tenant_status", [
  "pending",
  "provisioning",
  "running",
  "stopped",
  "failed",
  "terminating",
  "terminated",
]);

export const resourceTypeEnum = pgEnum("resource_type", [
  "network",
  "postgres",
  "redis",
  "medusa",
]);

export const resourceStatusEnum = pgEnum("resource_status", [
  "creating",
  "running",
  "stopped",
  "error",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "created",
  "provisioning_started",
  "provisioning_completed",
  "started",
  "stopped",
  "restarted",
  "failed",
  "terminating",
  "terminated",
]);

export const metricTypeEnum = pgEnum("metric_type", [
  "cpu",
  "memory",
  "disk",
  "orders",
  "revenue",
  "customers",
  "products",
]);

// Tables
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  subdomain: varchar("subdomain", { length: 100 }).notNull().unique(),
  status: tenantStatusEnum("status").notNull().default("pending"),
  config: jsonb("config").$type<TenantConfig>().default({}),
  adminEmail: varchar("admin_email", { length: 255 }),
  adminPassword: varchar("admin_password", { length: 255 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const tenantResources = pgTable("tenant_resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  resourceType: resourceTypeEnum("resource_type").notNull(),
  containerId: varchar("container_id", { length: 100 }),
  containerName: varchar("container_name", { length: 255 }),
  networkId: varchar("network_id", { length: 100 }),
  status: resourceStatusEnum("status").notNull().default("creating"),
  port: integer("port"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantEvents = pgTable("tenant_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  eventType: eventTypeEnum("event_type").notNull(),
  message: text("message"),
  details: jsonb("details").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tenantMetrics = pgTable("tenant_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  metricType: metricTypeEnum("metric_type").notNull(),
  value: decimal("value", { precision: 20, scale: 4 }).notNull(),
  unit: varchar("unit", { length: 50 }),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const platformConfig = pgTable("platform_config", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: jsonb("value").$type<unknown>(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Types
export type TenantConfig = {
  medusaPort?: number;
  adminPort?: number;
  postgresPort?: number;
  redisPort?: number;
  storeCors?: string;
  adminCors?: string;
  environment?: Record<string, string>;
};

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantResource = typeof tenantResources.$inferSelect;
export type NewTenantResource = typeof tenantResources.$inferInsert;
export type TenantEvent = typeof tenantEvents.$inferSelect;
export type NewTenantEvent = typeof tenantEvents.$inferInsert;
export type TenantMetric = typeof tenantMetrics.$inferSelect;
export type NewTenantMetric = typeof tenantMetrics.$inferInsert;
