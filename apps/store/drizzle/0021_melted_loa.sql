CREATE TABLE "email_broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subject" varchar(500) NOT NULL,
	"html" text NOT NULL,
	"total_recipients" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"sent_by_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_broadcasts" ADD CONSTRAINT "email_broadcasts_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_broadcasts_tenant_idx" ON "email_broadcasts" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "email_messages" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."email_message_type";