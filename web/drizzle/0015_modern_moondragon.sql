CREATE TABLE "company_document_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(512) NOT NULL,
	"category" varchar(128) NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"access_type" varchar(32) NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_documents_access_type_check" CHECK ("company_documents"."access_type" IN ('PUBLIC', 'RESTRICTED'))
);
--> statement-breakpoint
ALTER TABLE "company_document_permissions" ADD CONSTRAINT "company_document_permissions_document_id_company_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."company_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_document_permissions" ADD CONSTRAINT "company_document_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;