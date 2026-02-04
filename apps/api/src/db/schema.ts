import {
	boolean,
	decimal,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
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
	"store",
	"client",
]);

export const resourceStatusEnum = pgEnum("resource_status", [
	"creating",
	"running",
	"stopped",
	"error",
]);

export const eventTypeEnum = pgEnum("event_type", [
	"created",
	"tenant_created",
	"provisioning_started",
	"provisioning_completed",
	"provisioning_failed",
	"network_created",
	"postgres_created",
	"postgres_healthy",
	"store_created",
	"client_created",
	"image_pulling",
	"service_updating",
	"started",
	"tenant_started",
	"stopped",
	"tenant_stopped",
	"restarted",
	"failed",
	"terminating",
	"deletion_started",
	"terminated",
	"upgrade_started",
	"upgrade_completed",
	"upgrade_failed",
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
	storeVersion: varchar("store_version", { length: 50 }),
	imageTag: varchar("image_tag", { length: 255 }),
	clientVersion: varchar("client_version", { length: 50 }),
	clientImageTag: varchar("client_image_tag", { length: 255 }),
	lastUpgradedAt: timestamp("last_upgraded_at", { mode: "date" }),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
	deletedAt: timestamp("deleted_at"),
});

export const tenantResources = pgTable(
	"tenant_resources",
	{
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
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		// Ensure only one resource of each type per tenant
		uniqueIndex("tenant_resource_unique_idx").on(
			table.tenantId,
			table.resourceType,
		),
	],
);

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

export const platformImages = pgTable("platform_images", {
	id: uuid("id").primaryKey().defaultRandom(),
	version: varchar("version", { length: 50 }).notNull().unique(),
	imageTag: varchar("image_tag", { length: 255 }).notNull(),
	commitSha: varchar("commit_sha", { length: 40 }),
	releaseNotes: text("release_notes"),
	isLatest: boolean("is_latest").default(false),
	isDeprecated: boolean("is_deprecated").default(false),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

export const clientImages = pgTable("client_images", {
	id: uuid("id").primaryKey().defaultRandom(),
	version: varchar("version", { length: 50 }).notNull().unique(),
	imageTag: varchar("image_tag", { length: 255 }).notNull(),
	commitSha: varchar("commit_sha", { length: 40 }),
	releaseNotes: text("release_notes"),
	isLatest: boolean("is_latest").default(false),
	isDeprecated: boolean("is_deprecated").default(false),
	createdAt: timestamp("created_at", { mode: "date" }).defaultNow(),
});

// Types
export type TenantConfig = {
	storePort?: number;
	adminPort?: number;
	clientPort?: number;
	postgresPort?: number;
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
export type PlatformImage = typeof platformImages.$inferSelect;
export type NewPlatformImage = typeof platformImages.$inferInsert;
export type ClientImage = typeof clientImages.$inferSelect;
export type NewClientImage = typeof clientImages.$inferInsert;
