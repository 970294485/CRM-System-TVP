-- 在已執行 0007 合併遷移後，於 Neon SQL Editor 可手動執行此檔，插入示範科目（略過已存在代碼）。
-- 或使用：npm run db:seed:accounting-demo

INSERT INTO accounting_categories (category_code, category_name, account_type, description, is_active, sort_order)
SELECT '1000', '現金', 'Asset', '示範：庫存現金', true, 10
WHERE NOT EXISTS (SELECT 1 FROM accounting_categories c WHERE c.category_code = '1000');

INSERT INTO accounting_categories (category_code, category_name, account_type, description, is_active, sort_order)
SELECT '5100', '差旅費', 'Expense', '示範：報銷／差旅', true, 50
WHERE NOT EXISTS (SELECT 1 FROM accounting_categories c WHERE c.category_code = '5100');
