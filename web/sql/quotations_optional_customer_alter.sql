-- =============================================================================
-- 報價單：允許無 customer_id（新客戶僅填名稱等快照欄位）
-- 已存在舊表時執行本檔；與 quotations_po_inventory_init 一併由 apply 腳本執行。
-- =============================================================================

ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_name varchar;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_phone varchar;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_email varchar;

UPDATE quotations q
SET customer_name = c.name
FROM customers c
WHERE q.customer_id IS NOT NULL
  AND c.id = q.customer_id
  AND (q.customer_name IS NULL OR btrim(q.customer_name) = '');

UPDATE quotations
SET customer_name = '（未填客戶名）'
WHERE customer_name IS NULL OR btrim(customer_name) = '';

ALTER TABLE quotations ALTER COLUMN customer_name SET NOT NULL;

ALTER TABLE quotations ALTER COLUMN customer_id DROP NOT NULL;
