-- 客戶分析圖表：擴充 customers 主表（冪等）
-- web/: npm run db:apply:customer-analytics

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code VARCHAR(64);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS industry VARCHAR(128);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS region VARCHAR(128);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_status VARCHAR(32);

COMMENT ON COLUMN customers.customer_code IS '客戶編碼';
COMMENT ON COLUMN customers.industry IS '產業別（圖表：產業分佈）';
COMMENT ON COLUMN customers.region IS '地區';
COMMENT ON COLUMN customers.customer_status IS '帳務狀態，例如 Active / Inactive（規格中的 status）';
