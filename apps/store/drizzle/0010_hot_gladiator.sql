ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "quantity" SET DEFAULT '1';