ALTER TABLE "orders" DROP CONSTRAINT "orders_ticket_number_unique";--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_ticket_unique" UNIQUE("tenant_id","ticket_number");