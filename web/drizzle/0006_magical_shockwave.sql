CREATE TABLE IF NOT EXISTS "pt_accounting_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_code" text NOT NULL,
	"category_name" text NOT NULL,
	"account_type" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pt_accounting_categories_category_code_unique" UNIQUE("category_code"),
	CONSTRAINT "pt_accounting_categories_account_type_check" CHECK ("account_type" IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense'))
);
