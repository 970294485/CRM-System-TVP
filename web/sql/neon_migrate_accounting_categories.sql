-- =============================================================================
-- 修復：accounting_categories 缺少 category_code / account_type 等欄位
-- =============================================================================
-- 適用：表上仍為舊欄位 code, name, type（enum gl_category_type），或曾用 db:push
--       未完成「改名」導致結構與程式不一致。
--
-- 請在 Neon：SQL Editor → 選正確的 database → 整份貼上 → Run（可重複執行多數為安全）
--
-- 完成後請勿再對此表使用 drizzle-kit push 的互動「create column」；應以 migrate 或本腳本為準。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) 新欄位（若已存在則略過）
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS category_code text;
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS category_name text;
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS account_type text;
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.accounting_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- is_active / updated_at 補 NOT NULL（若欄位剛建立）
UPDATE public.accounting_categories SET is_active = true WHERE is_active IS NULL;
UPDATE public.accounting_categories SET updated_at = COALESCE(updated_at, created_at, now()) WHERE updated_at IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounting_categories' AND column_name = 'code'
  ) THEN
    UPDATE public.accounting_categories SET
      category_code = code,
      category_name = name,
      account_type = (CASE type::text
        WHEN 'income' THEN 'Revenue'
        WHEN 'expense' THEN 'Expense'
        WHEN 'asset' THEN 'Asset'
        WHEN 'liability' THEN 'Liability'
        WHEN 'equity' THEN 'Equity'
      END),
      updated_at = COALESCE(updated_at, created_at, now())
    WHERE category_code IS NULL;
  END IF;
END $$;

-- 合併 pt_accounting_categories（若曾建立過分表）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pt_accounting_categories'
  ) THEN
    INSERT INTO public.accounting_categories (
      id, category_code, category_name, account_type, description, is_active, sort_order, created_at, updated_at
    )
    SELECT
      gen_random_uuid(),
      p.category_code,
      p.category_name,
      p.account_type,
      p.description,
      COALESCE(p.is_active, true),
      0,
      p.created_at::timestamptz,
      COALESCE(p.updated_at, p.created_at)::timestamptz
    FROM public.pt_accounting_categories p
    WHERE NOT EXISTS (
      SELECT 1 FROM public.accounting_categories a WHERE a.category_code = p.category_code
    );
    DROP TABLE public.pt_accounting_categories;
  END IF;
END $$;

-- 仍為空的列：避免 SET NOT NULL 失敗（空表或異常資料）
UPDATE public.accounting_categories SET
  category_code = 'MIG-' || substring(replace(id::text, '-', ''), 1, 10)
WHERE category_code IS NULL;
UPDATE public.accounting_categories SET category_name = '未命名科目' WHERE category_name IS NULL OR trim(category_name) = '';
UPDATE public.accounting_categories SET account_type = 'Expense' WHERE account_type IS NULL OR trim(account_type) = '';

-- 2) 刪除舊欄位與 enum（先卸依賴）
ALTER TABLE public.accounting_categories DROP COLUMN IF EXISTS code;
ALTER TABLE public.accounting_categories DROP COLUMN IF EXISTS name;
ALTER TABLE public.accounting_categories DROP COLUMN IF EXISTS type;

DROP TYPE IF EXISTS public.gl_category_type;

ALTER TABLE public.accounting_categories ALTER COLUMN category_code SET NOT NULL;
ALTER TABLE public.accounting_categories ALTER COLUMN category_name SET NOT NULL;
ALTER TABLE public.accounting_categories ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE public.accounting_categories ALTER COLUMN is_active SET NOT NULL;
ALTER TABLE public.accounting_categories ALTER COLUMN is_active SET DEFAULT true;
ALTER TABLE public.accounting_categories ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.accounting_categories ALTER COLUMN updated_at SET DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS accounting_categories_category_code_unique
  ON public.accounting_categories (category_code);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounting_categories_account_type_check') THEN
    ALTER TABLE public.accounting_categories ADD CONSTRAINT accounting_categories_account_type_check CHECK (
      account_type IN ('Asset', 'Liability', 'Equity', 'Revenue', 'Expense')
    );
  END IF;
END $$;
