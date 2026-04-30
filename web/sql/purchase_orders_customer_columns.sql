-- 採購單：客戶／供應商（選填；與匯入 API 一致）
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers (id) ON DELETE SET NULL;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS customer_email text;
