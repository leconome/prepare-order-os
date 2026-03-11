ALTER TABLE "products" ADD COLUMN "woo_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_woo_id_idx" ON "products" USING btree ("tenant_id","woo_id");--> statement-breakpoint
ALTER TABLE "product_attributes" ADD COLUMN "woo_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "product_attributes_tenant_woo_id_idx" ON "product_attributes" USING btree ("tenant_id","woo_id");--> statement-breakpoint
ALTER TABLE "attribute_terms" ADD COLUMN "woo_id" integer;
