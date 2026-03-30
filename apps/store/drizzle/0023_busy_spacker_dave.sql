ALTER TABLE "products" ADD COLUMN "short_description" varchar(160);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gallery_urls" json DEFAULT '[]'::json;