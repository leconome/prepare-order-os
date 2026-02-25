CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_type" "discount_type";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_value" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL;