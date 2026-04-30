/**
 * 寫入文件分類示範：分類 2 筆、系統文件若干（含「文件分類」用與「個人網盤」PERSONAL_DRIVE 測試；依檔名已存在則略過）。
 * 個人網盤頁只顯示 entity_type=PERSONAL_DRIVE 且 entity_id=登入者 id；測試列綁定 admin@example.com。
 * web/: npm run db:seed:document-classification-demo
 *
 * 請先建立資料表：npm run db:migrate 或執行 web/sql/document_classification_init.sql
 */
import { config } from "dotenv";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function hasTable(sql: ReturnType<typeof getNeonSql>, table: string): Promise<boolean> {
  const rows = await sql.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function main() {
  const sql = getNeonSql();

  if (!(await hasTable(sql, "document_categories")) || !(await hasTable(sql, "system_documents"))) {
    console.error(
      "錯誤：找不到 document_categories / system_documents。\n" +
        "請先執行：npm run db:apply:document-classification-init\n" +
        "（或於 Neon 貼上 web/sql/document_classification_init.sql）\n" +
        "成功後再執行：npm run db:seed:document-classification-demo"
    );
    process.exit(1);
  }

  await sql.query(`
INSERT INTO document_categories (name, description)
SELECT v.name, v.description
FROM (
  VALUES
    ('客戶合約（測試）'::varchar, '示範：客戶相關合約附件'::varchar),
    ('匯款憑證（測試）'::varchar, '示範：收款／匯款證明'::varchar)
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM document_categories c WHERE c.name = v.name)
`);

  const insDoc1 = await sql.query(
    `INSERT INTO system_documents (
      file_name, file_url, category_id, entity_type, entity_id, file_size, mime_type
    )
    SELECT $1::varchar, $2::text, c.id, $3::varchar, NULL::uuid, $4::int, $5::varchar
    FROM document_categories c
    WHERE c.name = $6::varchar
      AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = $1)
    RETURNING id`,
    [
      "示範-客戶合約.pdf",
      "https://mock-storage.example.com/crm-uploads/demo/sample-contract.pdf",
      "CUSTOMER",
      245760,
      "application/pdf",
      "客戶合約（測試）",
    ]
  );

  const insDoc2 = await sql.query(
    `INSERT INTO system_documents (
      file_name, file_url, category_id, entity_type, entity_id, file_size, mime_type
    )
    SELECT $1::varchar, $2::text, c.id, NULL::varchar, NULL::uuid, $3::int, $4::varchar
    FROM document_categories c
    WHERE c.name = $5::varchar
      AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = $1)
    RETURNING id`,
    [
      "示範-匯款憑證.png",
      "https://mock-storage.example.com/crm-uploads/demo/sample-remittance.png",
      89432,
      "image/png",
      "匯款憑證（測試）",
    ]
  );

  const insDoc3 = await sql.query(
    `INSERT INTO system_documents (
      file_name, file_url, category_id, entity_type, entity_id, file_size, mime_type
    )
    SELECT $1::varchar, $2::text, c.id, $3::varchar, NULL::uuid, $4::int, $5::varchar
    FROM document_categories c
    WHERE c.name = $6::varchar
      AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = $1)
    RETURNING id`,
    [
      "測試-產品型錄.pdf",
      "https://mock-storage.example.com/crm-uploads/demo/test-catalog.pdf",
      "PURCHASE_ORDER",
      512000,
      "application/pdf",
      "客戶合約（測試）",
    ]
  );

  const insDoc4 = await sql.query(
    `INSERT INTO system_documents (
      file_name, file_url, category_id, entity_type, entity_id, file_size, mime_type
    )
    SELECT $1::varchar, $2::text, c.id, $3::varchar, NULL::uuid, $4::int, $5::varchar
    FROM document_categories c
    WHERE c.name = $6::varchar
      AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = $1)
    RETURNING id`,
    [
      "測試-報價單附件.docx",
      "https://mock-storage.example.com/crm-uploads/demo/test-quotation-attach.docx",
      "QUOTATION",
      128000,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "匯款憑證（測試）",
    ]
  );

  const adminRows = await sql.query(
    `SELECT id::text AS id FROM users WHERE lower(trim(email)) = lower($1) LIMIT 1`,
    ["admin@example.com"]
  );
  const adminId =
    Array.isArray(adminRows) &&
    adminRows[0] &&
    typeof (adminRows[0] as { id?: string }).id === "string"
      ? (adminRows[0] as { id: string }).id
      : null;

  let p1 = false;
  let p2 = false;
  if (!adminId) {
    console.log("略過個人網盤測試 2 筆：找不到 admin@example.com（請先執行 npm run db:seed 建立開發管理員）");
  } else {
    const insP1 = await sql.query(
      `INSERT INTO system_documents (
        file_name, file_url, category_id, entity_type, entity_id, file_size, mime_type
      )
      SELECT $1::varchar, $2::text, c.id, $3::varchar, $4::uuid, $5::int, $6::varchar
      FROM document_categories c
      WHERE c.name = $7::varchar
        AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = $1)
      RETURNING id`,
      [
        "測試-個人網盤-草稿.pdf",
        "https://mock-storage.example.com/crm-uploads/demo/personal-draft.pdf",
        "PERSONAL_DRIVE",
        adminId,
        20480,
        "application/pdf",
        "客戶合約（測試）",
      ]
    );
    const insP2 = await sql.query(
      `INSERT INTO system_documents (
        file_name, file_url, category_id, entity_type, entity_id, file_size, mime_type
      )
      SELECT $1::varchar, $2::text, c.id, $3::varchar, $4::uuid, $5::int, $6::varchar
      FROM document_categories c
      WHERE c.name = $7::varchar
        AND NOT EXISTS (SELECT 1 FROM system_documents d WHERE d.file_name = $1)
      RETURNING id`,
      [
        "測試-個人網盤-備忘.txt",
        "https://mock-storage.example.com/crm-uploads/demo/personal-notes.txt",
        "PERSONAL_DRIVE",
        adminId,
        512,
        "text/plain",
        "匯款憑證（測試）",
      ]
    );
    p1 = Array.isArray(insP1) && insP1.length > 0;
    p2 = Array.isArray(insP2) && insP2.length > 0;
  }

  const catRows = await sql.query(
    `SELECT name FROM document_categories WHERE name IN ('客戶合約（測試）', '匯款憑證（測試）') ORDER BY name`
  );
  const cats = Array.isArray(catRows) ? catRows.length : 0;

  const d1 = Array.isArray(insDoc1) && insDoc1.length > 0;
  const d2 = Array.isArray(insDoc2) && insDoc2.length > 0;
  const d3 = Array.isArray(insDoc3) && insDoc3.length > 0;
  const d4 = Array.isArray(insDoc4) && insDoc4.length > 0;
  console.log(`分類（測試名稱）已就緒：${cats} 筆`);
  console.log(d1 ? "已插入文件：示範-客戶合約.pdf" : "略過文件（已存在）：示範-客戶合約.pdf");
  console.log(d2 ? "已插入文件：示範-匯款憑證.png" : "略過文件（已存在）：示範-匯款憑證.png");
  console.log(d3 ? "已插入文件：測試-產品型錄.pdf" : "略過文件（已存在）：測試-產品型錄.pdf");
  console.log(d4 ? "已插入文件：測試-報價單附件.docx" : "略過文件（已存在）：測試-報價單附件.docx");
  if (adminId) {
    console.log(p1 ? "已插入個人網盤（admin）：測試-個人網盤-草稿.pdf" : "略過個人網盤文件（已存在）：測試-個人網盤-草稿.pdf");
    console.log(p2 ? "已插入個人網盤（admin）：測試-個人網盤-備忘.txt" : "略過個人網盤文件（已存在）：測試-個人網盤-備忘.txt");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
