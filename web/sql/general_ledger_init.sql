-- 總賬：手工記賬憑證（複式分錄）；請搭配 drizzle 0017 或獨立執行
CREATE TABLE IF NOT EXISTS "gl_journal_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "document_no" text NOT NULL,
  "entry_date" date NOT NULL,
  "memo" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "gl_journal_entries_document_no_unique" UNIQUE ("document_no")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gl_journal_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "journal_entry_id" uuid NOT NULL REFERENCES "gl_journal_entries"("id") ON DELETE CASCADE,
  "line_no" integer NOT NULL,
  "accounting_item_id" uuid NOT NULL REFERENCES "accounting_items"("id") ON DELETE RESTRICT,
  "debit" numeric(18, 2) DEFAULT '0' NOT NULL,
  "credit" numeric(18, 2) DEFAULT '0' NOT NULL,
  "line_memo" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "gl_journal_lines_debit_non_negative" CHECK ("debit" >= 0),
  CONSTRAINT "gl_journal_lines_credit_non_negative" CHECK ("credit" >= 0),
  CONSTRAINT "gl_journal_lines_one_side_positive" CHECK (
    ("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gl_journal_lines_entry_line_uidx"
  ON "gl_journal_lines" ("journal_entry_id", "line_no");
