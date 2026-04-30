/**
 * 寫入示範會計科目（含一筆隨機代碼），可重複執行；已存在的 category_code 會略過。
 * web/: npm run db:seed:accounting-demo
 *
 * 若提示缺少 category_code，請先執行：npm run db:migrate（需套用 0007_merge_accounting_categories）
 */
import { randomBytes } from "crypto";
import { config } from "dotenv";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";

type Row = {
  categoryCode: string;
  categoryName: string;
  accountType: AccountType;
  description: string | null;
  sortOrder: number;
};

const staticRows: Row[] = [
  {
    categoryCode: "1000",
    categoryName: "現金",
    accountType: "Asset",
    description: "示範：庫存現金",
    sortOrder: 10,
  },
  {
    categoryCode: "2000",
    categoryName: "應付帳款",
    accountType: "Liability",
    description: "示範：供應商應付款",
    sortOrder: 20,
  },
  {
    categoryCode: "3000",
    categoryName: "資本公積",
    accountType: "Equity",
    description: null,
    sortOrder: 30,
  },
  {
    categoryCode: "4000",
    categoryName: "營業收入",
    accountType: "Revenue",
    description: "示範：主要收入科目",
    sortOrder: 40,
  },
  {
    categoryCode: "5100",
    categoryName: "差旅費",
    accountType: "Expense",
    description: "示範：報銷／差旅",
    sortOrder: 50,
  },
];

async function hasColumn(sql: ReturnType<typeof getNeonSql>, table: string, column: string): Promise<boolean> {
  const rows = await sql.query(
    `SELECT 1 AS ok FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function insertIfMissing(
  sql: ReturnType<typeof getNeonSql>,
  r: Row
): Promise<"inserted" | "skipped"> {
  const result = await sql.query(
    `INSERT INTO accounting_categories (
      category_code, category_name, account_type, description, is_active, sort_order
    )
    SELECT $1::text, $2::text, $3::text, $4::text, true, $5::int
    WHERE NOT EXISTS (
      SELECT 1 FROM accounting_categories c WHERE c.category_code = $1
    )
    RETURNING id`,
    [r.categoryCode, r.categoryName, r.accountType, r.description, r.sortOrder]
  );
  const inserted = Array.isArray(result) && result.length > 0;
  return inserted ? "inserted" : "skipped";
}

async function main() {
  const sql = getNeonSql();

  const ok = await hasColumn(sql, "accounting_categories", "category_code");
  if (!ok) {
    console.error(
      "錯誤：資料表 accounting_categories 仍為舊結構（沒有 category_code）。\n" +
        "請在 web 目錄執行：npm run db:migrate\n" +
        "成功後再執行：npm run db:seed:accounting-demo"
    );
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of staticRows) {
    const s = await insertIfMissing(sql, r);
    if (s === "inserted") {
      inserted++;
      console.log("Inserted:", r.categoryCode, r.categoryName, `(${r.accountType})`);
    } else skipped++;
  }

  const randomCode = `R${randomBytes(3).toString("hex").toUpperCase()}`;
  const randomRow: Row = {
    categoryCode: randomCode,
    categoryName: "隨機示範科目",
    accountType: "Expense",
    description: `自動建立於 ${new Date().toISOString()}`,
    sortOrder: 99,
  };
  const rs = await insertIfMissing(sql, randomRow);
  if (rs === "inserted") {
    inserted++;
    console.log("Inserted (random):", randomRow.categoryCode, randomRow.categoryName);
  } else skipped++;

  console.log(`Done. inserted=${inserted}, skipped (duplicate code)=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
