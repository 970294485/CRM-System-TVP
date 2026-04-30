-- 文件分類／系統文件：示範資料（各 2 筆，可依名稱略過已存在列）
-- Neon SQL Editor 貼上執行，或：npm run db:seed:document-classification-demo

INSERT INTO document_categories (name, description)
SELECT v.name, v.description
FROM (
  VALUES
    ('客戶合約（測試）'::varchar, '示範：客戶相關合約附件'::varchar),
    ('匯款憑證（測試）'::varchar, '示範：收款／匯款證明'::varchar)
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM document_categories c WHERE c.name = v.name);

INSERT INTO system_documents (
  file_name,
  file_url,
  category_id,
  entity_type,
  entity_id,
  file_size,
  mime_type
)
SELECT
  '示範-客戶合約.pdf',
  'https://mock-storage.example.com/crm-uploads/demo/sample-contract.pdf',
  c.id,
  'CUSTOMER',
  NULL::uuid,
  245760,
  'application/pdf'
FROM document_categories c
WHERE c.name = '客戶合約（測試）'
  AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = '示範-客戶合約.pdf');

INSERT INTO system_documents (
  file_name,
  file_url,
  category_id,
  entity_type,
  entity_id,
  file_size,
  mime_type
)
SELECT
  '示範-匯款憑證.png',
  'https://mock-storage.example.com/crm-uploads/demo/sample-remittance.png',
  c.id,
  NULL::varchar,
  NULL::uuid,
  89432,
  'image/png'
FROM document_categories c
WHERE c.name = '匯款憑證（測試）'
  AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = '示範-匯款憑證.png');

-- 額外測試資料 2 筆（檔名不同，可與上方示範並存）
INSERT INTO system_documents (
  file_name,
  file_url,
  category_id,
  entity_type,
  entity_id,
  file_size,
  mime_type
)
SELECT
  '測試-產品型錄.pdf',
  'https://mock-storage.example.com/crm-uploads/demo/test-catalog.pdf',
  c.id,
  'PURCHASE_ORDER',
  NULL::uuid,
  512000,
  'application/pdf'
FROM document_categories c
WHERE c.name = '客戶合約（測試）'
  AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = '測試-產品型錄.pdf');

INSERT INTO system_documents (
  file_name,
  file_url,
  category_id,
  entity_type,
  entity_id,
  file_size,
  mime_type
)
SELECT
  '測試-報價單附件.docx',
  'https://mock-storage.example.com/crm-uploads/demo/test-quotation-attach.docx',
  c.id,
  'QUOTATION',
  NULL::uuid,
  128000,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
FROM document_categories c
WHERE c.name = '匯款憑證（測試）'
  AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = '測試-報價單附件.docx');

-- 個人網盤測試 2 筆（僅在存在 admin@example.com 時寫入；「個人網盤」頁用 PERSONAL_DRIVE + 使用者 id 篩選）
INSERT INTO system_documents (
  file_name,
  file_url,
  category_id,
  entity_type,
  entity_id,
  file_size,
  mime_type
)
SELECT
  '測試-個人網盤-草稿.pdf',
  'https://mock-storage.example.com/crm-uploads/demo/personal-draft.pdf',
  c.id,
  'PERSONAL_DRIVE',
  (SELECT id FROM users WHERE lower(trim(email)) = lower('admin@example.com') ORDER BY created_at NULLS LAST LIMIT 1),
  20480,
  'application/pdf'
FROM document_categories c
WHERE c.name = '客戶合約（測試）'
  AND EXISTS (SELECT 1 FROM users WHERE lower(trim(email)) = lower('admin@example.com'))
  AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = '測試-個人網盤-草稿.pdf');

INSERT INTO system_documents (
  file_name,
  file_url,
  category_id,
  entity_type,
  entity_id,
  file_size,
  mime_type
)
SELECT
  '測試-個人網盤-備忘.txt',
  'https://mock-storage.example.com/crm-uploads/demo/personal-notes.txt',
  c.id,
  'PERSONAL_DRIVE',
  (SELECT id FROM users WHERE lower(trim(email)) = lower('admin@example.com') ORDER BY created_at NULLS LAST LIMIT 1),
  512,
  'text/plain'
FROM document_categories c
WHERE c.name = '匯款憑證（測試）'
  AND EXISTS (SELECT 1 FROM users WHERE lower(trim(email)) = lower('admin@example.com'))
  AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = '測試-個人網盤-備忘.txt');
