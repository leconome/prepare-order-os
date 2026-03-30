CREATE TYPE "public"."wc_resource_type" AS ENUM('product', 'category', 'product_variant');--> statement-breakpoint
CREATE TYPE "public"."wc_sync_action" AS ENUM('product_push', 'category_push', 'variant_push', 'stock_push', 'order_received', 'backfill', 'webhook_registered', 'connection_test', 'error');--> statement-breakpoint
CREATE TYPE "public"."wc_sync_status" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TABLE "woo_commerce_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"store_url" varchar(500) NOT NULL,
	"consumer_key" varchar(500) NOT NULL,
	"consumer_secret" varchar(500) NOT NULL,
	"webhook_secret" varchar(255) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_health_check_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "woo_commerce_connections_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "woo_commerce_id_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"resource_type" "wc_resource_type" NOT NULL,
	"local_id" uuid NOT NULL,
	"remote_id" integer NOT NULL,
	"last_pushed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wc_id_mappings_unique" UNIQUE("tenant_id","resource_type","local_id")
);
--> statement-breakpoint
CREATE TABLE "woo_commerce_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" "wc_sync_action" NOT NULL,
	"status" "wc_sync_status" NOT NULL,
	"summary" varchar(500) NOT NULL,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "woo_commerce_connections" ADD CONSTRAINT "woo_commerce_connections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "woo_commerce_id_mappings" ADD CONSTRAINT "woo_commerce_id_mappings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "woo_commerce_sync_logs" ADD CONSTRAINT "woo_commerce_sync_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wc_connections_tenant_id_idx" ON "woo_commerce_connections" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "wc_id_mappings_tenant_id_idx" ON "woo_commerce_id_mappings" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "wc_id_mappings_remote_id_idx" ON "woo_commerce_id_mappings" USING btree ("tenant_id","resource_type","remote_id");--> statement-breakpoint
CREATE INDEX "wc_sync_logs_tenant_id_idx" ON "woo_commerce_sync_logs" USING btree ("tenant_id");