/**
 * 寫入採購單與庫存示範資料各最多 2 筆（不含報價單；相同單號／示範 SKU 已存在則略過）。
 * web/: npm run db:seed:documents-demo
 *
 * 請先：npm run db:apply:documents-init（含 purchase_orders 客戶欄位變更）
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

  if (!(await hasTable(sql, "purchase_orders")) || !(await hasTable(sql, "inventory"))) {
    console.error(
      "錯誤：找不到 purchase_orders / inventory 資料表。\n" +
        "請執行：npm run db:apply:documents-init\n" +
        "成功後再執行：npm run db:seed:documents-demo"
    );
    process.exit(1);
  }

  const today = new Date().toISOString().slice(0, 10);

  const poItemsA = JSON.stringify([
    {
      name: "示範採購品 A",
      sku: "DEMO-PO-1",
      qty: 2,
      price: 750,
      specifications: { unit: "件" },
    },
  ]);
  const poItemsB = JSON.stringify([
    { name: "示範採購品 B", sku: "DEMO-PO-2", qty: 5, price: 120, specifications: {} },
  ]);

  let inserted = 0;
  let skipped = 0;

  const p1 = await sql.query(
    `INSERT INTO purchase_orders (
      po_no, original_system_id, total_amount, items, po_date, status, payment_status, paid_amount,
      customer_name, customer_phone, customer_email
    )
    SELECT $1::text, $2::text, $3::numeric, $4::jsonb, $5::date, 'Legacy_Imported', 'Unpaid', 0::numeric,
      $6::text, $7::text, $8::text
    WHERE NOT EXISTS (SELECT 1 FROM purchase_orders p WHERE p.po_no = $1)
    RETURNING id`,
    [
      "示範：測試-PO-001",
      "LEGACY-PO-001",
      "1500.00",
      poItemsA,
      today,
      "示範客戶（採購甲）",
      "02-0000-0001",
      "demo-po-vendor-a@example.com",
    ]
  );
  if (Array.isArray(p1) && p1.length > 0) {
    inserted++;
    console.log("Inserted PO: 示範：測試-PO-001");
  } else {
    skipped++;
    console.log("Skipped PO (exists): 示範：測試-PO-001");
  }

  const p2 = await sql.query(
    `INSERT INTO purchase_orders (
      po_no, original_system_id, total_amount, items, po_date, status, payment_status, paid_amount,
      customer_name, customer_phone
    )
    SELECT $1::text, $2::text, $3::numeric, $4::jsonb, $5::date, 'Legacy_Imported', 'Partial', 300::numeric,
      $6::text, $7::text
    WHERE NOT EXISTS (SELECT 1 FROM purchase_orders p WHERE p.po_no = $1)
    RETURNING id`,
    ["示範：測試-PO-002", "LEGACY-PO-002", "600.00", poItemsB, today, "示範客戶（採購乙）", "0912-345-678"]
  );
  if (Array.isArray(p2) && p2.length > 0) {
    inserted++;
    console.log("Inserted PO: 示範：測試-PO-002");
  } else {
    skipped++;
    console.log("Skipped PO (exists): 示範：測試-PO-002");
  }

  async function ensureSeedProduct(sku: string, name: string): Promise<void> {
    await sql.query(
      `INSERT INTO products (sku, name, attributes, specifications, image_urls, is_active)
       SELECT $1::text, $2::text, '{}'::jsonb, '{}'::jsonb, ARRAY[]::text[], true
       WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.sku = $1)`,
      [sku, name]
    );
  }

  let productIds: string[] = [];
  if (await hasTable(sql, "products")) {
    let prodRows = await sql.query(
      `SELECT id::text AS id FROM products ORDER BY created_at ASC NULLS LAST LIMIT 2`
    );
    if (Array.isArray(prodRows)) {
      for (const row of prodRows) {
        const id = (row as { id: string }).id;
        if (typeof id === "string" && id) productIds.push(id);
      }
    }
    if (productIds.length === 0) {
      await ensureSeedProduct("DEMO-SEED-INV-A", "示範：庫存測試產品甲");
      await ensureSeedProduct("DEMO-SEED-INV-B", "示範：庫存測試產品乙");
      prodRows = await sql.query(
        `SELECT id::text AS id FROM products WHERE sku IN ('DEMO-SEED-INV-A', 'DEMO-SEED-INV-B') ORDER BY sku ASC`
      );
      productIds = [];
      if (Array.isArray(prodRows)) {
        for (const row of prodRows) {
          const id = (row as { id: string }).id;
          if (typeof id === "string" && id) productIds.push(id);
        }
      }
    }
  } else {
    console.log("（略過庫存：沒有 products 資料表。）");
  }

  if (productIds.length > 0) {
    const pid1 = productIds[0]!;
    const pid2 = productIds[1] ?? pid1;

    const inv1 = await sql.query(
      `INSERT INTO inventory (
        product_id, sku, warehouse_location, stock_qty, unit_cost, last_counted_date
      )
      SELECT $1::uuid, $2::text, $3::text, $4::int, $5::numeric, $6::date
      WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.sku = $2)
      RETURNING id`,
      [pid1, "示範：測試-庫存-001", "主倉-A", 100, "85.50", today]
    );
    if (Array.isArray(inv1) && inv1.length > 0) {
      inserted++;
      console.log("Inserted inventory SKU: 示範：測試-庫存-001");
    } else {
      skipped++;
      console.log("Skipped inventory (sku exists): 示範：測試-庫存-001");
    }

    const inv2 = await sql.query(
      `INSERT INTO inventory (
        product_id, sku, warehouse_location, stock_qty, unit_cost, last_counted_date
      )
      SELECT $1::uuid, $2::text, $3::text, $4::int, $5::numeric, $6::date
      WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.sku = $2)
      RETURNING id`,
      [pid2, "示範：測試-庫存-002", "主倉-B", 48, "120.00", today]
    );
    if (Array.isArray(inv2) && inv2.length > 0) {
      inserted++;
      console.log("Inserted inventory SKU: 示範：測試-庫存-002");
    } else {
      skipped++;
      console.log("Skipped inventory (sku exists): 示範：測試-庫存-002");
    }
  } else if (await hasTable(sql, "products")) {
    console.log("（略過庫存：無法取得產品 id。）");
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
