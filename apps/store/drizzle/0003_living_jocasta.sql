ALTER TABLE "tenants" ADD COLUMN "preparation_filter_days" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock" integer;