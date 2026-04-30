CREATE TABLE IF NOT EXISTS "employee_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_name" text NOT NULL,
	"department" text,
	"base_salary" numeric(10, 2),
	"commission_rate" numeric(5, 2),
	"work_start_time" time,
	"work_end_time" time,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_import_staging" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_type" text NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_index" integer NOT NULL,
	"record" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_import_staging_batch_idx" ON "data_import_staging" ("batch_id");
