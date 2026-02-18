CREATE TYPE "public"."sms_credit_transaction_type" AS ENUM('grant', 'spend', 'revoke');--> statement-breakpoint
CREATE TYPE "public"."sms_message_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "sms_credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"type" "sms_credit_transaction_type" NOT NULL,
	"description" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"recipient_phone" varchar(20) NOT NULL,
	"recipient_name" varchar(255),
	"content" text NOT NULL,
	"status" "sms_message_status" DEFAULT 'pending' NOT NULL,
	"ovh_message_id" varchar(255),
	"credits_cost" integer DEFAULT 1 NOT NULL,
	"sent_by_id" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sms_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_credit_transactions" ADD CONSTRAINT "sms_credit_transactions_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_sent_by_id_users_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_credit_tx_tenant_idx" ON "sms_credit_transactions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sms_messages_tenant_idx" ON "sms_messages" USING btree ("tenant_id");