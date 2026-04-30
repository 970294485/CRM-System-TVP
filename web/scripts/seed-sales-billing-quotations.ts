/**
 * 為「銷售開單管理」寫入 2 筆示範報價單（quote_no 已存在則略過）。
 * web/: npm run db:seed:sales-billing-demo
 *
 * 請先：npm run db:apply:documents-init
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

type CustomerRow = { id: string; name: string };

async function main() {
  const sql = getNeonSql();

  if (!(await hasTable(sql, "quotations"))) {
    console.error(
      "錯誤：找不到 quotations 資料表。\n" + "請執行：npm run db:apply:documents-init\n" + "成功後再執行：npm run db:seed:sales-billing-demo"
    );
    process.exit(1);
  }

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
  const items1 = JSON.stringify([
    { name: "示範報價品項 A", sku: "DEMO-QT-1", qty: 2, price: 4500 },
    { name: "安裝服務", sku: null, qty: 1, price: 2000 },
  ]);
  const items2 = JSON.stringify([{ name: "示範報價品項 B", sku: "DEMO-QT-2", qty: 10, price: 320.5 }]);

  let inserted = 0;
  let skipped = 0;

  const name1 = c1?.name ?? "示範客戶（未連結主檔）甲";
  const name2 = c2 && c2.id !== c1?.id ? c2.name : c1?.name ?? "示範客戶（未連結主檔）乙";
  const id1 = c1?.id ?? null;
  const id2 = c2 && c2.id !== c1?.id ? c2.id : c1?.id ?? null;

  const q1 = await sql.query(
    `INSERT INTO quotations (
      quote_no, customer_id, customer_name, customer_phone, customer_email,
      total_amount, items, status, quote_date
    )
    SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text, $6::numeric, $7::jsonb, $8::text, $9::date
    WHERE NOT EXISTS (SELECT 1 FROM quotations q WHERE q.quote_no = $1)
    RETURNING id`,
    [
      "示範：銷售開單-QT-001",
      id1,
      name1,
      "02-1234-5678",
      "demo-quote-a@example.com",
      "11000.00",
      items1,
      "Draft",
      today,
    ]
  );
  if (Array.isArray(q1) && q1.length > 0) {
    inserted++;
    console.log("Inserted quotation: 示範：銷售開單-QT-001");
  } else {
    skipped++;
    console.log("Skipped quotation (exists): 示範：銷售開單-QT-001");
  }

  const q2 = await sql.query(
    `INSERT INTO quotations (
      quote_no, customer_id, customer_name, customer_phone, customer_email,
      total_amount, items, status, quote_date
    )
    SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text, $6::numeric, $7::jsonb, $8::text, $9::date
    WHERE NOT EXISTS (SELECT 1 FROM quotations q WHERE q.quote_no = $1)
    RETURNING id`,
    [
      "示範：銷售開單-QT-002",
      id2,
      name2,
      "0922-000-888",
      "demo-quote-b@example.com",
      "3205.00",
      items2,
      "Sent",
      today,
    ]
  );
  if (Array.isArray(q2) && q2.length > 0) {
    inserted++;
    console.log("Inserted quotation: 示範：銷售開單-QT-002");
  } else {
    skipped++;
    console.log("Skipped quotation (exists): 示範：銷售開單-QT-002");
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
