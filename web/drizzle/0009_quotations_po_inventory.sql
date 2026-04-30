CREATE TABLE IF NOT EXISTS "quotations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_no" text NOT NULL UNIQUE,
	"customer_id" uuid NOT NULL,
	"total_amount" numeric(12, 2) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'Legacy_Imported' NOT NULL,
	"quote_date" date NOT NULL
);--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"po_no" text NOT NULL UNIQUE,
	"original_system_id" text,
	"total_amount" numeric(12, 2) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"po_date" date NOT NULL,
	"status" text DEFAULT 'Legacy_Imported' NOT NULL,
	"payment_status" text DEFAULT 'Unpaid' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_payment_status_check" CHECK ("purchase_orders"."payment_status" IN ('Unpaid', 'Partial', 'Paid'))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"warehouse_location" text,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"unit_cost" numeric(10, 2),
	"last_counted_date" date
);--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_product_id_idx" ON "inventory" ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_sku_idx" ON "inventory" ("sku");
