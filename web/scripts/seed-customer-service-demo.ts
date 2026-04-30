/**
 * 寫入 2 筆客服案件示範資料（含備註）；相同 case_no 已存在則略過。
 * web/: npm run db:seed:customer-service-demo
 *
 * 請先：npm run db:apply:customer-service-init
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

  if (!(await hasTable(sql, "customer_service_cases"))) {
    console.error(
      "錯誤：找不到 customer_service_cases。\n" + "請執行：npm run db:apply:customer-service-init"
    );
    process.exit(1);
  }

  const usersRows = await sql.query(
    `SELECT id::text AS id FROM users ORDER BY created_at ASC NULLS LAST LIMIT 1`
  );
  const userId =
    Array.isArray(usersRows) && usersRows[0] && typeof (usersRows[0] as { id: string }).id === "string"
      ? (usersRows[0] as { id: string }).id
      : null;

  const custRows = await sql.query(
    `SELECT id::text AS id, name::text AS name FROM customers ORDER BY updated_at DESC NULLS LAST LIMIT 1`
  );
  const customerRow =
    Array.isArray(custRows) && custRows[0]
      ? (custRows[0] as { id: string; name: string })
      : null;

  let inserted = 0;
  let skipped = 0;

  const case1No = "示範：CS-SEED-001";
  const r1 = await sql.query(
    `INSERT INTO customer_service_cases (
      case_no, customer_id, customer_name_snapshot, title, category, channel,
      status, priority, summary, created_by_user_id, opened_at, updated_at
    )
    SELECT $1::text, $2::uuid, $3::text, $4::text, $5::text, $6::text,
      $7::text, $8::text, $9::text, $10::uuid, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM customer_service_cases c WHERE c.case_no = $1)
    RETURNING id::text AS id`,
    [
      case1No,
      customerRow?.id ?? null,
      customerRow?.name ?? "示範客戶（未連結主檔）",
      "詢問產品規格與報價週期",
      "inquiry",
      "phone",
      "in_progress",
      "high",
      "客戶來電想了解 A 系列交期，已告知需依訂製項目評估。",
      userId,
    ]
  );

  if (Array.isArray(r1) && r1[0] && typeof (r1[0] as { id: string }).id === "string") {
    inserted++;
    const cid = (r1[0] as { id: string }).id;
    console.log(`Inserted case: ${case1No}`);
    await sql.query(
      `INSERT INTO customer_service_case_notes (case_id, body, created_by_user_id)
       VALUES ($1::uuid, $2::text, $3::uuid)`,
      [cid, "已記錄客戶聯絡電話，約定三日內以 Email 回覆正式報價。", userId]
    );
    await sql.query(
      `INSERT INTO customer_service_case_notes (case_id, body, created_by_user_id)
       VALUES ($1::uuid, $2::text, $3::uuid)`,
      [cid, "內部備註：可搭配現有報價單範本回覆。", userId]
    );
  } else {
    skipped++;
    console.log(`Skipped case (exists): ${case1No}`);
  }

  const case2No = "示範：CS-SEED-002";
  const r2 = await sql.query(
    `INSERT INTO customer_service_cases (
      case_no, customer_id, customer_name_snapshot, title, category, channel,
      status, priority, summary, created_by_user_id, opened_at, updated_at
    )
    SELECT $1::text, NULL::uuid, $2::text, $3::text, $4::text, $5::text,
      $6::text, $7::text, $8::text, $9::uuid, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM customer_service_cases c WHERE c.case_no = $1)
    RETURNING id::text AS id`,
    [
      case2No,
      "來信訪客（無主檔）",
      "發票抬頭錯誤需重開",
      "billing",
      "email",
      "open",
      "medium",
      "客戶透過客服信箱反應上月發票抬頭與統編不符。",
      userId,
    ]
  );

  if (Array.isArray(r2) && r2[0] && typeof (r2[0] as { id: string }).id === "string") {
    inserted++;
    const cid = (r2[0] as { id: string }).id;
    console.log(`Inserted case: ${case2No}`);
    await sql.query(
      `INSERT INTO customer_service_case_notes (case_id, body, created_by_user_id)
       VALUES ($1::uuid, $2::text, $3::uuid)`,
      [cid, "已請財務確認原發票號碼與沖銷流程，待客戶補件營業登記影本。", userId]
    );
  } else {
    skipped++;
    console.log(`Skipped case (exists): ${case2No}`);
  }

  console.log(`Done. inserted_cases=${inserted}, skipped_cases=${skipped}`);
  if (!userId) {
    console.log("（提示：資料庫無 users，備註與案件的建立者欄位為 NULL。可先 npm run db:seed:dev-admin）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
