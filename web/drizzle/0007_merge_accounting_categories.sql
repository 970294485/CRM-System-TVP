-- 合併 legacy `accounting_categories`（code/name/type）與 `pt_accounting_categories` 為單一 `accounting_categories`（category_code / account_type 英文五大類）
-- 可重複執行：已遷移過則多數步驟為 no-op

ALTER TABLE "accounting_categories" ADD COLUMN IF NOT EXISTS "category_code" text;--> statement-breakpoint
ALTER TABLE "accounting_categories" ADD COLUMN IF NOT EXISTS "category_name" text;--> statement-breakpoint
ALTER TABLE "accounting_categories" ADD COLUMN IF NOT EXISTS "account_type" text;--> statement-breakpoint
ALTER TABLE "accounting_categories" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "accounting_categories" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_categories" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz DEFAULT now() NOT NULL;--> statement-breakpoint

DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_categories' AND column_name = 'code'
  ) THEN
    UPDATE "accounting_categories" SET
      "category_code" = "code",
      "category_name" = "name",
      "account_type" = (CASE "type"::text
        WHEN 'income' THEN 'Revenue'
        WHEN 'expense' THEN 'Expense'
        WHEN 'asset' THEN 'Asset'
        WHEN 'liability' THEN 'Liability'
        WHEN 'equity' THEN 'Equity'
      END),
      "updated_at" = COALESCE("updated_at", "created_at", now())
    WHERE "category_code" IS NULL;
  END IF;
END
$migrate$;--> statement-breakpoint

DO $ptmerge$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pt_accounting_categories'
  ) THEN
    INSERT INTO "accounting_categories" (
      "id", "category_code", "category_name", "account_type", "description", "is_active", "sort_order", "created_at", "updated_at"
    )
    SELECT
      gen_random_uuid(),
      p."category_code",
      p."category_name",
      p."account_type",
      p."description",
      p."is_active",
      0,
      p."created_at"::timestamptz,
      COALESCE(p."updated_at", p."created_at")::timestamptz
    FROM "pt_accounting_categories" p
    WHERE NOT EXISTS (
      SELECT 1 FROM "accounting_categories" a WHERE a."category_code" = p."category_code"
    );
    DROP TABLE "pt_accounting_categories";
  END IF;
END
$ptmerge$;--> statement-breakpoint

ALTER TABLE "accounting_categories" DROP COLUMN IF EXISTS "code";--> statement-breakpoint
ALTER TABLE "accounting_categories" DROP COLUMN IF EXISTS "name";--> statement-breakpoint
ALTER TABLE "accounting_categories" DROP COLUMN IF EXISTS "type";--> statement-breakpoint

DROP TYPE IF EXISTS "public"."gl_category_type";--> statement-breakpoint

ALTER TABLE "accounting_categories" ALTER COLUMN "category_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_categories" ALTER COLUMN "category_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_categories" ALTER COLUMN "account_type" SET NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_categories_category_code_unique" ON "accounting_categories" ("category_code");--> statement-breakpoint

DO $chk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounting_categories_account_type_check'
  ) THEN
    ALTER TABLE "accounting_categories" ADD CONSTRAINT "accounting_categories_account_type_check" CHECK (
      "account_type" IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')
    );
  END IF;
END
$chk$;
