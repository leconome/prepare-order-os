CREATE TYPE "public"."pos_type" AS ENUM('pickup_location', 'permanent_pos');--> statement-breakpoint
CREATE TABLE "points_of_sale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"address" text,
	"phone" varchar(20),
	"type" "pos_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"tenant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "points_of_sale_tenant_name_unique" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "pos_id" uuid;--> statement-breakpoint
ALTER TABLE "points_of_sale" ADD CONSTRAINT "points_of_sale_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "points_of_sale_tenant_id_idx" ON "points_of_sale" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pos_id_points_of_sale_id_fk" FOREIGN KEY ("pos_id") REFERENCES "public"."points_of_sale"("id") ON DELETE set null ON UPDATE no action;