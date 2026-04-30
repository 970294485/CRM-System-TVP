CREATE TABLE "accounting_company_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"current_fiscal_year" integer NOT NULL,
	"base_currency_iso" varchar(12) DEFAULT 'TWD' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year_month" varchar(7) NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_periods_year_month_ck" CHECK ("accounting_periods"."year_month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_periods_year_month_uidx" ON "accounting_periods" USING btree ("year_month");
