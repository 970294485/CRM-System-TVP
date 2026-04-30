/**
 * 寫入 2 筆報價單測試資料（與銷售管理 /api/sales/quotations 欄位對齊）。
 * web/: npm run db:seed:quotations-test
 *
 * 請先：npm run db:apply:documents-init
 * 建議：npm run db:apply:quotations-sales（含 valid_until、subtotal、稅額等）
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

async function hasColumn(sql: ReturnType<typeof getNeonSql>, column: string): Promise<boolean> {
  const rows = await sql.query(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = $1 LIMIT 1`,
    [column]
  );
  return Array.isArray(rows) && rows.length > 0;
}

type CustomerRow = { id: string; name: string };

const QUOTE_NO_1 = "TEST-QT-DEMO-001";
const QUOTE_NO_2 = "TEST-QT-DEMO-002";

async function main() {
  const sql = getNeonSql();

  if (!(await hasTable(sql, "quotations"))) {
    console.error(
      "找不到 quotations 表。請執行：npm run db:apply:documents-init\n完成後再執行：npm run db:seed:quotations-test"
    );
    process.exit(1);
  }

  const extended = await hasColumn(sql, "valid_until");

  let custRows: unknown[] = [];
  if (await hasTable(sql, "customers")) {
    const r = await sql.query(
      `SELECT id::text AS id, name FROM customers ORDER BY created_at ASC NULLS LAST LIMIT 2`
    );
    custRows = Array.isArray(r) ? r : [];
  }
  const customers: CustomerRow[] = custRows
    .map((r) => {
      const row = r as { id?: string; name?: string };
      return row.id && row.name ? { id: row.id, name: row.name } : null;
    })
    .filter((x): x is CustomerRow => x != null);

  const c1 = customers[0];
  const c2 = customers[1] ?? customers[0];
  const today = new Date().toISOString().slice(0, 10);
  const valid1 = new Date(`${today}T12:00:00`);
  valid1.setDate(valid1.getDate() + 30);
  const validUntil1 = valid1.toISOString().slice(0, 10);
  const valid2 = new Date(`${today}T12:00:00`);
  valid2.setDate(valid2.getDate() + 15);
  const validUntil2 = valid2.toISOString().slice(0, 10);

  const name1 = c1?.name ?? "測試客戶甲（無主檔）";
  const name2 = c2 && c2.id !== c1?.id ? c2.name : c1?.name ?? "測試客戶乙（無主檔）";
  const id1 = c1?.id ?? null;
  const id2 = c2 && c2.id !== c1?.id ? c2.id : c1?.id ?? null;

  const items1 = JSON.stringify([
    { name: "測試品項 A", sku: "TEST-A", qty: 2, unit_price: 4000, discount: 0, line_total: 8000 },
    { name: "測試安裝服務", sku: "TEST-SVC", qty: 1, unit_price: 2000, discount: 0, line_total: 2000 },
  ]);
  const items2 = JSON.stringify([
    { name: "測試品項 B", sku: "TEST-B", qty: 10, unit_price: 500, discount: 5, line_total: 4750 },
  ]);

  /** 未稅小計 10000，稅 5% → 500，含稅 10500 */
  const subtotal1 = "10000.00";
  const taxRate1 = "5.00";
  const taxAmt1 = "500.00";
  const total1 = "10500.00";

  /** 未稅 4750，稅 5% → 237.5，含稅 4987.50 */
  const subtotal2 = "4750.00";
  const taxRate2 = "5.00";
  const taxAmt2 = "237.50";
  const total2 = "4987.50";

  let inserted = 0;
  let skipped = 0;

  if (extended) {
    const r1 = await sql.query(
      `INSERT INTO quotations (
        quote_no, customer_id, customer_name, customer_phone, customer_email,
        quote_date, valid_until, items, subtotal, tax_rate, tax_amount, total_amount, status, notes
      )
      SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text,
        $6::date, $7::date, $8::jsonb, $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::text, $14::text
      WHERE NOT EXISTS (SELECT 1 FROM quotations q WHERE q.quote_no = $1)
      RETURNING id`,
      [
        QUOTE_NO_1,
        id1,
        name1,
        "02-1111-2222",
        "test-qt-1@example.com",
        today,
        validUntil1,
        items1,
        subtotal1,
        taxRate1,
        taxAmt1,
        total1,
        "Draft",
        "測試備註：含運費另計；本報價為種子資料。",
      ]
    );
    if (Array.isArray(r1) && r1.length > 0) {
      inserted++;
      console.log(`Inserted: ${QUOTE_NO_1}`);
    } else {
      skipped++;
      console.log(`Skipped (exists): ${QUOTE_NO_1}`);
    }

    const r2 = await sql.query(
      `INSERT INTO quotations (
        quote_no, customer_id, customer_name, customer_phone, customer_email,
        quote_date, valid_until, items, subtotal, tax_rate, tax_amount, total_amount, status, notes
      )
      SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text,
        $6::date, $7::date, $8::jsonb, $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::text, $14::text
      WHERE NOT EXISTS (SELECT 1 FROM quotations q WHERE q.quote_no = $1)
      RETURNING id`,
      [
        QUOTE_NO_2,
        id2,
        name2,
        "0933-444-555",
        "test-qt-2@example.com",
        today,
        validUntil2,
        items2,
        subtotal2,
        taxRate2,
        taxAmt2,
        total2,
        "Sent",
        "測試備註：種子資料，狀態為已寄出。",
      ]
    );
    if (Array.isArray(r2) && r2.length > 0) {
      inserted++;
      console.log(`Inserted: ${QUOTE_NO_2}`);
    } else {
      skipped++;
      console.log(`Skipped (exists): ${QUOTE_NO_2}`);
    }
  } else {
    console.warn("未偵測到 quotations.valid_until 等擴充欄位，改寫入精簡列（請執行 npm run db:apply:quotations-sales 以啟用完整欄位）。");
    const r1 = await sql.query(
      `INSERT INTO quotations (
        quote_no, customer_id, customer_name, customer_phone, customer_email,
        total_amount, items, status, quote_date
      )
      SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text, $6::numeric, $7::jsonb, $8::text, $9::date
      WHERE NOT EXISTS (SELECT 1 FROM quotations q WHERE q.quote_no = $1)
      RETURNING id`,
      [QUOTE_NO_1, id1, name1, "02-1111-2222", "test-qt-1@example.com", total1, items1, "Draft", today]
    );
    if (Array.isArray(r1) && r1.length > 0) inserted++;
    else skipped++;

    const r2 = await sql.query(
      `INSERT INTO quotations (
        quote_no, customer_id, customer_name, customer_phone, customer_email,
        total_amount, items, status, quote_date
      )
      SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text, $6::numeric, $7::jsonb, $8::text, $9::date
      WHERE NOT EXISTS (SELECT 1 FROM quotations q WHERE q.quote_no = $1)
      RETURNING id`,
      [QUOTE_NO_2, id2, name2, "0933-444-555", "test-qt-2@example.com", total2, items2, "Sent", today]
    );
    if (Array.isArray(r2) && r2.length > 0) inserted++;
    else skipped++;
  }

  const verify = await sql.query(
    `SELECT quote_no FROM quotations WHERE quote_no IN ($1::text, $2::text) ORDER BY quote_no`,
    [QUOTE_NO_1, QUOTE_NO_2]
  );
  const found = Array.isArray(verify) ? verify.length : 0;
  console.log(`Done. inserted=${inserted}, skipped=${skipped}; DB 中可見測試單 ${found}/2 筆。`);
  if (found < 2 && inserted === 0 && skipped === 2) {
    console.log("提示：兩筆單號已存在時會 skipped，畫面應仍能看到 TEST-QT-DEMO-001 / 002；若仍無資料請確認 .env.local 的 DATABASE_URL 與 Next 應用相同。");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
