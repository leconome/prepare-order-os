DROP INDEX "users_tenant_pin_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_tenant_pin_unique" ON "users" USING btree ("tenant_id","pin") WHERE "users"."tenant_id" IS NOT NULL AND "users"."pin" IS NOT NULL;