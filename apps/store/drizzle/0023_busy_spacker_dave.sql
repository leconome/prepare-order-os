ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "short_description" varchar(160);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "gallery_urls" json DEFAULT '[]'::json;