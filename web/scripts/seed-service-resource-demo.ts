/**
 * 寫入 2 筆服務資源預約示範資料（並確保 2 個示範場地）；相同標題已存在則略過。
 * web/: npm run db:seed:service-resource-demo
 *
 * 請先：npm run db:apply:customer-service-init && npm run db:apply:service-resource-booking-init
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

  if (!(await hasTable(sql, "service_resource_venues"))) {
    console.error(
      "錯誤：找不到 service_resource_venues。\n" + "請執行：npm run db:apply:service-resource-booking-init"
    );
    process.exit(1);
  }
  if (!(await hasTable(sql, "service_resource_bookings"))) {
    console.error(
      "錯誤：找不到 service_resource_bookings。\n" + "請執行：npm run db:apply:service-resource-booking-init"
    );
    process.exit(1);
  }

  const usersRows = await sql.query(
    `SELECT id::text AS id FROM users WHERE is_active = true ORDER BY created_at ASC NULLS LAST LIMIT 1`
  );
  const userId =
    Array.isArray(usersRows) && usersRows[0] && typeof (usersRows[0] as { id: string }).id === "string"
      ? (usersRows[0] as { id: string }).id
      : null;

  let caseId: string | null = null;
  if (await hasTable(sql, "customer_service_cases")) {
    const cr = await sql.query(`SELECT id::text AS id FROM customer_service_cases ORDER BY opened_at DESC LIMIT 1`);
    if (Array.isArray(cr) && cr[0] && typeof (cr[0] as { id: string }).id === "string") {
      caseId = (cr[0] as { id: string }).id;
    }
  }

  async function ensureVenue(name: string, venueType: string, capacity: number, note: string): Promise<string | null> {
    await sql.query(
      `INSERT INTO service_resource_venues (name, venue_type, capacity, location_note, is_active, created_at, updated_at)
       SELECT $1::text, $2::text, $3::int, $4::text, TRUE, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM service_resource_venues v WHERE v.name = $1)`,
      [name, venueType, capacity, note]
    );
    const r = await sql.query(`SELECT id::text AS id FROM service_resource_venues WHERE name = $1 LIMIT 1`, [name]);
    if (Array.isArray(r) && r[0] && typeof (r[0] as { id: string }).id === "string") {
      return (r[0] as { id: string }).id;
    }
    return null;
  }

  const v1Name = "示範：會議室 Alpha";
  const v2Name = "示範：維修工位 Beta";
  const vid1 = await ensureVenue(v1Name, "room", 8, "種子資料 — 會議／培訓");
  const vid2 = await ensureVenue(v2Name, "bay", 2, "種子資料 — 設備維修");
  if (!vid1 || !vid2) {
    console.error("無法解析示範場地 id");
    process.exit(1);
  }
  console.log(`場地主檔 OK: ${v1Name}, ${v2Name}`);

  const day = new Date();
  day.setDate(day.getDate() + 3);
  const y = day.getFullYear();
  const m = day.getMonth();
  const d = day.getDate();

  const starts1 = new Date(y, m, d, 10, 0, 0, 0);
  const ends1 = new Date(y, m, d, 11, 30, 0, 0);
  const starts2 = new Date(y, m, d, 14, 0, 0, 0);
  const ends2 = new Date(y, m, d, 16, 0, 0, 0);

  let insertedBookings = 0;
  let skippedBookings = 0;

  const bookings: {
    title: string;
    venueId: string;
    starts: Date;
    ends: Date;
    purchase: string | null;
    costMinor: number | null;
    notes: string;
  }[] = [
    {
      title: "示範預約-SEED-001",
      venueId: vid1,
      starts: starts1,
      ends: ends1,
      purchase: "備用投影線（示範）",
      costMinor: 1500,
      notes: "客戶到府簡報，需投影設備。（種子資料）",
    },
    {
      title: "示範預約-SEED-002",
      venueId: vid2,
      starts: starts2,
      ends: ends2,
      purchase: null,
      costMinor: null,
      notes: "例行檢修時段占位。（種子資料）",
    },
  ];

  for (const b of bookings) {
    const r = await sql.query(
      `INSERT INTO service_resource_bookings (
        title,
        customer_service_case_id,
        staff_user_id,
        venue_id,
        starts_at,
        ends_at,
        purchase_note,
        estimated_cost_minor,
        notes,
        created_by_user_id,
        created_at,
        updated_at
      )
      SELECT $1::text, $2::uuid, NULL::uuid, $3::uuid,
        $4::timestamptz, $5::timestamptz, $6::text, $7::int, $8::text,
        $9::uuid, now(), now()
      WHERE NOT EXISTS (SELECT 1 FROM service_resource_bookings x WHERE x.title = $1)
      RETURNING id::text AS id`,
      [
        b.title,
        caseId,
        b.venueId,
        b.starts.toISOString(),
        b.ends.toISOString(),
        b.purchase,
        b.costMinor,
        b.notes,
        userId,
      ]
    );
    if (Array.isArray(r) && r[0] && typeof (r[0] as { id: string }).id === "string") {
      insertedBookings++;
      console.log(`Inserted booking: ${b.title}`);
    } else {
      skippedBookings++;
      console.log(`Skipped booking (exists): ${b.title}`);
    }
  }

  console.log(
    `Done. inserted_bookings=${insertedBookings}, skipped_bookings=${skippedBookings}, demo_date=${starts1.toISOString().slice(0, 10)}`
  );
  if (!userId) {
    console.log("（提示：無使用中 users，預約的建立者為 NULL；可先 npm run db:seed:dev-admin）");
  }
  if (!caseId) {
    console.log("（提示：未關聯客服案件；可先 npm run db:seed:customer-service-demo）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
