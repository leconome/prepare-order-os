CREATE TABLE "order_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"is_prepared" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_products" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "is_menu" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "is_prepared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_menu_items" ADD CONSTRAINT "order_menu_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;