CREATE TABLE IF NOT EXISTS "purchase_order_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"warehouse_location" text,
	"qty_received" integer NOT NULL,
	"unit_cost" numeric(10, 2),
	"line_name_snapshot" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "purchase_order_receipts" ADD CONSTRAINT "purchase_order_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_receipts" ADD CONSTRAINT "purchase_order_receipts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_receipts_po_idx" ON "purchase_order_receipts" ("purchase_order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_order_receipts_product_idx" ON "purchase_order_receipts" ("product_id");
