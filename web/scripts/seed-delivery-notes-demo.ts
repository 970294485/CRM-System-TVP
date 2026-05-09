/**
 * 為「送貨管理」寫入最多 3 筆示範送貨單（dn_no 已存在則略過）。
 * web/: npm run db:seed:delivery-notes-demo
 *
 * 請先：npm run db:apply:delivery-notes，且資料庫中至少有一筆非「已取消」的銷售合同。
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

function hkTodayMinus(days: number): string {
  const s = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Hong_Kong", hour12: false }).slice(0, 10);
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

type ContractRow = {
  id: string;
  contract_no: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  items: unknown;
};

function normalizeRows(raw: unknown): ContractRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      const row = r as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      const contract_no = typeof row.contract_no === "string" ? row.contract_no : null;
      const customer_name = typeof row.customer_name === "string" ? row.customer_name : null;
      if (!id || !contract_no || !customer_name) return null;
      const customer_id =
        row.customer_id != null && String(row.customer_id).trim() !== "" ? String(row.customer_id) : null;
      const items: unknown = row.items !== undefined && row.items !== null ? row.items : [];
      return {
        id,
        contract_no,
        customer_id,
        customer_name,
        customer_phone: row.customer_phone != null ? String(row.customer_phone) : null,
        customer_email: row.customer_email != null ? String(row.customer_email) : null,
        items,
      };
    })
    .filter((x): x is ContractRow => x !== null);
}

async function main() {
  const sql = getNeonSql();

  if (!(await hasTable(sql, "delivery_notes"))) {
    console.error(
      "錯誤：找不到 delivery_notes 資料表。\n請執行：npm run db:apply:delivery-notes\n成功後再執行：npm run db:seed:delivery-notes-demo"
    );
    process.exit(1);
  }

  if (!(await hasTable(sql, "sales_contracts"))) {
    console.error("錯誤：找不到 sales_contracts 資料表。\n請先套用銷售合同相關 migration。");
    process.exit(1);
  }

  const rawContracts = await sql.query(
    `SELECT sc.id::text AS id,
            sc.contract_no,
            sc.customer_id::text AS customer_id,
            sc.customer_name,
            sc.customer_phone,
            sc.customer_email,
            sc.items
     FROM sales_contracts sc
     WHERE COALESCE(sc.status, '') <> 'Cancelled'
     ORDER BY sc.contract_date DESC NULLS LAST, sc.created_at DESC NULLS LAST
     LIMIT 8`,
    []
  );

  const contracts = normalizeRows(rawContracts);
  if (contracts.length === 0) {
    console.error(
      "錯誤：沒有可用的銷售合同（需至少一筆且狀態非 Cancelled）。\n請先在「銷售合同」建立合同，或執行既有銷售／合同種子腳本後再試。"
    );
    process.exit(1);
  }

  const demos: { dn: string; dayOff: number; note: string; status: string }[] = [
    { dn: "示範-DN-DEMO-001", dayOff: 0, note: "示範資料：本批預計今日出車。", status: "Issued" },
    { dn: "示範-DN-DEMO-002", dayOff: 1, note: "示範資料：附檢貨單，請客戶簽收。", status: "Issued" },
    { dn: "示範-DN-DEMO-003", dayOff: 2, note: "示範資料：部分品項待補貨。", status: "Draft" },
  ];

  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i]!;
    const c = contracts[i % contracts.length]!;
    const itemsJson = JSON.stringify(
      Array.isArray(c.items) ? c.items : typeof c.items === "object" && c.items !== null ? c.items : []
    );
    const shipDate = hkTodayMinus(demo.dayOff);

    const ins = await sql.query(
      `INSERT INTO delivery_notes (
        dn_no, contract_id, source_contract_no, customer_id, customer_name,
        customer_phone, customer_email, ship_to_address, ship_date, items, notes, status
      )
      SELECT $1::varchar, $2::uuid, $3::varchar,
             CASE WHEN $4::text IS NULL OR TRIM($4::text) = '' THEN NULL ELSE $4::uuid END,
             $5::varchar, $6::varchar, $7::varchar, NULL,
             $8::date, $9::jsonb, $10::varchar, $11::varchar
      WHERE NOT EXISTS (SELECT 1 FROM delivery_notes d WHERE d.dn_no = $1)
      RETURNING id::text`,
      [
        demo.dn,
        c.id,
        c.contract_no,
        c.customer_id,
        c.customer_name,
        c.customer_phone,
        c.customer_email,
        shipDate,
        itemsJson,
        demo.note,
        demo.status,
      ]
    );

    if (Array.isArray(ins) && ins.length > 0) {
      inserted++;
      console.log(`Inserted delivery note: ${demo.dn} → 合同 ${c.contract_no}`);
    } else {
      skipped++;
      console.log(`Skipped (exists): ${demo.dn}`);
    }
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
