CREATE TYPE "public"."catalog_kind" AS ENUM('product', 'service');--> statement-breakpoint
CREATE TYPE "public"."catalog_spec_value_type" AS ENUM('text', 'number', 'enum');--> statement-breakpoint
CREATE TABLE "catalog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"kind" "catalog_kind" NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"name_en" text,
	"description" text,
	"marketing_notes" text,
	"unit" text,
	"list_price" numeric(14, 2),
	"currency" text DEFAULT 'TWD' NOT NULL,
	"min_price_floor_percent" numeric(5, 2),
	"default_tax_rate" numeric(8, 6),
	"spec_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"is_draft" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_spec_key_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid,
	"key_slug" text NOT NULL,
	"label" text NOT NULL,
	"value_type" "catalog_spec_value_type" DEFAULT 'text' NOT NULL,
	"enum_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"filterable" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parent_id_catalog_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."catalog_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_category_id_catalog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."catalog_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_spec_key_definitions" ADD CONSTRAINT "catalog_spec_key_definitions_category_id_catalog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."catalog_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_items_sku_unique" ON "catalog_items" USING btree ("sku") WHERE "catalog_items"."sku" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_spec_keys_global_slug" ON "catalog_spec_key_definitions" USING btree ("key_slug") WHERE "catalog_spec_key_definitions"."category_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_spec_keys_cat_slug" ON "catalog_spec_key_definitions" USING btree ("category_id","key_slug") WHERE "catalog_spec_key_definitions"."category_id" IS NOT NULL;