CREATE TYPE "public"."order_source" AS ENUM('comptoir', 'telephone', 'site_web');--> statement-breakpoint
CREATE TYPE "public"."client_type" AS ENUM('particulier', 'professionnel');--> statement-breakpoint
ALTER TYPE "public"."unit_type" ADD VALUE 'litre';--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "default_qty" numeric(10, 3);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" "order_source" DEFAULT 'comptoir' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "type" "client_type" DEFAULT 'particulier' NOT NULL;