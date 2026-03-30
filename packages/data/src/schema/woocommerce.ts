import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { tenants } from "./tenants.js";

// Enums
export const wcResourceType = pgEnum("wc_resource_type", [
  "product",
  "category",
  "product_variant",
]);

export const wcSyncAction = pgEnum("wc_sync_action", [
  "product_push",
  "category_push",
  "variant_push",
  "stock_push",
  "order_received",
  "backfill",
  "webhook_registered",
  "connection_test",
  "error",
]);

export const wcSyncStatus = pgEnum("wc_sync_status", ["success", "failure"]);

// Tables
export const wooCommerceConnections = pgTable(
  "woo_commerce_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: "cascade" }),
    storeUrl: varchar("store_url", { length: 500 }).notNull(),
    consumerKey: varchar("consumer_key", { length: 500 }).notNull(),
    consumerSecret: varchar("consumer_secret", { length: 500 }).notNull(),
    webhookSecret: varchar("webhook_secret", { length: 255 }).notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastHealthCheckAt: timestamp("last_health_check_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("wc_connections_tenant_id_idx").on(table.tenantId)],
);

export const wooCommerceIdMappings = pgTable(
  "woo_commerce_id_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    resourceType: wcResourceType("resource_type").notNull(),
    localId: uuid("local_id").notNull(),
    remoteId: integer("remote_id").notNull(),
    lastPushedAt: timestamp("last_pushed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("wc_id_mappings_unique").on(
      table.tenantId,
      table.resourceType,
      table.localId,
    ),
    index("wc_id_mappings_tenant_id_idx").on(table.tenantId),
    index("wc_id_mappings_remote_id_idx").on(
      table.tenantId,
      table.resourceType,
      table.remoteId,
    ),
  ],
);

export const wooCommerceSyncLogs = pgTable(
  "woo_commerce_sync_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    action: wcSyncAction("action").notNull(),
    status: wcSyncStatus("status").notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    details: text("details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("wc_sync_logs_tenant_id_idx").on(table.tenantId)],
);

// Zod schemas
export const connectWooCommerceSchema = z.object({
  storeUrl: z
    .string()
    .url("Invalid URL")
    .min(1)
    .transform((v) => v.replace(/\/+$/, "")), // strip trailing slash
  consumerKey: z.string().min(1, "Consumer key is required"),
  consumerSecret: z.string().min(1, "Consumer secret is required"),
});

export const toggleWooCommerceSchema = z.object({
  isEnabled: z.boolean(),
});

// Types
export type WooCommerceConnection = typeof wooCommerceConnections.$inferSelect;
export type WooCommerceIdMapping = typeof wooCommerceIdMappings.$inferSelect;
export type WooCommerceSyncLog = typeof wooCommerceSyncLogs.$inferSelect;
export type ConnectWooCommerce = z.infer<typeof connectWooCommerceSchema>;
export type ToggleWooCommerce = z.infer<typeof toggleWooCommerceSchema>;
