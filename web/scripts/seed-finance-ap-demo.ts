/**
 * 寫入 2 筆應付請款單草稿（掛鉤既有或新建的採購單）。
 * web/: npm run db:apply:finance-payment-advance && npm run db:seed:finance-ap-demo
 *
 * 若庫內採購單不足 2 筆，會自動插入 2 筆最小採購單再掛請款。
 */
import { config } from "dotenv";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

type Sql = ReturnType<typeof getNeonSql>;

async function hasTable(sql: Sql, table: string): Promise<boolean> {
  const rows = await sql.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function ensureTwoPurchaseOrders(sql: Sql): Promise<[string, string]> {
  const rows = await sql.query(
    `SELECT id::text AS id FROM purchase_orders ORDER BY created_at ASC NULLS LAST, po_no ASC LIMIT 2`
  );
  const ids: string[] = [];
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const id = (r as { id: string }).id;
      if (id) ids.push(id);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const items = (name: string, sku: string) =>
    JSON.stringify([{ name, sku, qty: 1, price: 100, specifications: {} }]);

  if (ids.length < 1) {
    const ins = await sql.query(
      `INSERT INTO purchase_orders (
        po_no, total_amount, items, po_date, status, payment_status, paid_amount, customer_name
      ) VALUES ($1, $2::numeric, $3::jsonb, $4::date, 'Legacy_Imported', 'Unpaid', 0, $5)
      RETURNING id::text AS id`,
      [
        "種子-採購-AP-A",
        "1500.00",
        items("種子料號 A", "SEED-AP-A"),
        today,
        "種子供應商甲",
      ]
    );
    if (Array.isArray(ins) && ins[0]) ids.push(String((ins[0] as { id: string }).id));
  }

  if (ids.length < 2) {
    const ins = await sql.query(
      `INSERT INTO purchase_orders (
        po_no, total_amount, items, po_date, status, payment_status, paid_amount, customer_name
      ) VALUES ($1, $2::numeric, $3::jsonb, $4::date, 'Legacy_Imported', 'Unpaid', 0, $5)
      RETURNING id::text AS id`,
      ["種子-採購-AP-B", "800.00", items("種子料號 B", "SEED-AP-B"), today, "種子供應商乙"]
    );
    if (Array.isArray(ins) && ins[0]) ids.push(String((ins[0] as { id: string }).id));
  }

  if (ids.length < 2) {
    throw new Error("無法取得兩筆採購單 id");
  }

  return [ids[0]!, ids[1]!];
}

async function main() {
  const sql = getNeonSql();

  if (!(await hasTable(sql, "finance_ap_payment_requests"))) {
    console.error(
      "找不到 finance_ap_payment_requests。請先執行：npm run db:apply:finance-payment-advance"
    );
    process.exit(1);
  }
  if (!(await hasTable(sql, "purchase_orders"))) {
    console.error("找不到 purchase_orders。請先執行：npm run db:apply:documents-init");
    process.exit(1);
  }

  const [po1, po2] = await ensureTwoPurchaseOrders(sql);
  const today = new Date().toISOString().slice(0, 10);

  const seeds: { doc: string; po: string; amount: string; notes: string }[] = [
    { doc: "示範-PR-AP-001", po: po1, amount: "500.00", notes: "種子資料：第一筆請款草稿" },
    { doc: "示範-PR-AP-002", po: po2, amount: "320.50", notes: "種子資料：第二筆請款草稿" },
  ];

  let added = 0;
  for (const s of seeds) {
    const r = await sql.query(
      `INSERT INTO finance_ap_payment_requests (
        document_no, purchase_order_id, amount, request_date, status, notes
      )
      SELECT $1::text, $2::uuid, $3::numeric, $4::date, 'Draft', $5::text
      WHERE NOT EXISTS (SELECT 1 FROM finance_ap_payment_requests f WHERE f.document_no = $1)
      RETURNING id::text`,
      [s.doc, s.po, s.amount, today, s.notes]
    );
    if (Array.isArray(r) && r.length > 0) {
      added++;
      console.log(`已新增應付請款：${s.doc} → 採購單 ${s.po.slice(0, 8)}…`);
    } else {
      console.log(`已略過（單號已存在）：${s.doc}`);
    }
  }

  console.log(`完成。本次新增 ${added} 筆；若皆已存在則為 0。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
