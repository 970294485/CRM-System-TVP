-- =============================================================================
-- 報價單（銷售管理）：有效期、未稅小計、稅率、稅額、備註
-- 可單獨執行：web/ npm run db:apply:quotations-sales
-- 或併入 npm run db:apply:documents-init（已加入該腳本清單）
-- =============================================================================

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS valid_until date;

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS subtotal numeric(12, 2);

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax_rate numeric(5, 2);

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS tax_amount numeric(12, 2);

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS notes text;

-- 既有資料：視為已含稅總額＝未稅小計、無稅額拆分；稅率 0
UPDATE quotations
SET
  subtotal = COALESCE(subtotal, total_amount),
  tax_rate = COALESCE(tax_rate, 0),
  tax_amount = COALESCE(tax_amount, 0)
WHERE subtotal IS NULL OR tax_rate IS NULL OR tax_amount IS NULL;

UPDATE quotations
SET valid_until = (quote_date + interval '30 days')::date
WHERE valid_until IS NULL;
