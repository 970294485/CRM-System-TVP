CREATE TABLE IF NOT EXISTS "document_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"description" varchar(512),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" varchar(512) NOT NULL,
	"file_url" text NOT NULL,
	"category_id" uuid NOT NULL,
	"entity_type" varchar(64),
	"entity_id" uuid,
	"file_size" integer DEFAULT 0 NOT NULL,
	"mime_type" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "system_documents" ADD CONSTRAINT "system_documents_category_id_document_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."document_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_documents_category_id_idx" ON "system_documents" ("category_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_documents_entity_type_idx" ON "system_documents" ("entity_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "system_documents_entity_idx" ON "system_documents" ("entity_type","entity_id");
