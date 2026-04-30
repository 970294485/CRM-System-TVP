CREATE TABLE IF NOT EXISTS "email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar(500) NOT NULL,
	"base_body_html" text NOT NULL,
	"target_group" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'Draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_queue_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"email_address" text NOT NULL,
	"customized_subject" varchar(500) NOT NULL,
	"customized_body_html" text NOT NULL,
	"status" varchar(32) DEFAULT 'Pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_queue_logs" ADD CONSTRAINT "email_queue_logs_campaign_id_email_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."email_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_queue_logs" ADD CONSTRAINT "email_queue_logs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_queue_logs_campaign_id_idx" ON "email_queue_logs" ("campaign_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_queue_logs_campaign_status_idx" ON "email_queue_logs" ("campaign_id", "status");
