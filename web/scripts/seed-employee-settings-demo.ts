/**
 * 寫入 2 筆人事設置示範資料（可重複執行；同名 employee_name 已存在則略過）。
 * web/: npm run db:seed:hr-demo
 *
 * 若資料表不存在，請先執行 web/sql/employee_settings_init.sql 或 npm run db:migrate。
 */
import { config } from "dotenv";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

type DemoRow = {
  employeeName: string;
  department: string | null;
  baseSalary: string | null;
  commissionRate: string | null;
  workStart: string | null;
  workEnd: string | null;
  isActive: boolean;
};

const staticRows: DemoRow[] = [
  {
    employeeName: "示範：人事測試-業務甲",
    department: "業務部",
    baseSalary: "35000.00",
    commissionRate: "0.05",
    workStart: "09:00:00",
    workEnd: "18:00:00",
    isActive: true,
  },
  {
    employeeName: "示範：人事測試-內勤乙",
    department: "行政部",
    baseSalary: "28000.00",
    commissionRate: "0.00",
    workStart: "08:30:00",
    workEnd: "17:30:00",
    isActive: true,
  },
];

async function hasTable(sql: ReturnType<typeof getNeonSql>, table: string): Promise<boolean> {
  const rows = await sql.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
    [table]
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function insertIfMissing(sql: ReturnType<typeof getNeonSql>, r: DemoRow): Promise<"inserted" | "skipped"> {
  const result = await sql.query(
    `INSERT INTO employee_settings (
      employee_name, department, base_salary, commission_rate,
      work_start_time, work_end_time, is_active
    )
    SELECT $1::text, $2::text, $3::numeric, $4::numeric, $5::time, $6::time, $7::boolean
    WHERE NOT EXISTS (
      SELECT 1 FROM employee_settings e WHERE e.employee_name = $1
    )
    RETURNING id`,
    [r.employeeName, r.department, r.baseSalary, r.commissionRate, r.workStart, r.workEnd, r.isActive]
  );
  const inserted = Array.isArray(result) && result.length > 0;
  return inserted ? "inserted" : "skipped";
}

async function main() {
  const sql = getNeonSql();

  const ok = await hasTable(sql, "employee_settings");
  if (!ok) {
    console.error(
      "錯誤：找不到資料表 employee_settings。\n" +
        "請在 web 目錄執行：npm run db:apply:hr-init\n" +
        "（或於 Neon 執行 sql/employee_settings_init.sql；亦可嘗試 npm run db:migrate）\n" +
        "成功後再執行：npm run db:seed:hr-demo"
    );
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const r of staticRows) {
    const s = await insertIfMissing(sql, r);
    if (s === "inserted") {
      inserted++;
      console.log("Inserted:", r.employeeName);
    } else {
      skipped++;
      console.log("Skipped (name exists):", r.employeeName);
    }
  }

  console.log(`Done. inserted=${inserted}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
