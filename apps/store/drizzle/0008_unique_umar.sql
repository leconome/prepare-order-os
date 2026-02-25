CREATE TYPE "public"."unit_type" AS ENUM('piece', 'kg');--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "unit_type" "unit_type" DEFAULT 'piece' NOT NULL;