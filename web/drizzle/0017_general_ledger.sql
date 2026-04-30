CREATE TABLE "gl_journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_no" text NOT NULL,
	"entry_date" date NOT NULL,
	"memo" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gl_journal_entries_document_no_unique" UNIQUE("document_no")
);
--> statement-breakpoint
ALTER TABLE "gl_journal_entries" ADD CONSTRAINT "gl_journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "gl_journal_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"accounting_item_id" uuid NOT NULL,
	"debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"line_memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gl_journal_lines_debit_non_negative" CHECK ("gl_journal_lines"."debit" >= 0),
	CONSTRAINT "gl_journal_lines_credit_non_negative" CHECK ("gl_journal_lines"."credit" >= 0),
	CONSTRAINT "gl_journal_lines_one_side_positive" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0))
);
--> statement-breakpoint
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_entry_id_gl_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."gl_journal_entries"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_accounting_item_id_accounting_items_id_fk" FOREIGN KEY ("accounting_item_id") REFERENCES "public"."accounting_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "gl_journal_lines_entry_line_uidx" ON "gl_journal_lines" USING btree ("journal_entry_id","line_no");
