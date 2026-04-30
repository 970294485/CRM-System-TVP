/**
 * 套用 sql/service_resource_booking_init.sql
 * web/: npm run db:apply:service-resource-booking-init
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";
import { splitSqlStatements } from "./sql-split";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const sql = getNeonSql();
  const path = resolve(process.cwd(), "sql", "service_resource_booking_init.sql");
  const file = readFileSync(path, "utf8");
  const statements = splitSqlStatements(file);
  let n = 0;
  for (const st of statements) {
    const text = st.endsWith(";") ? st : `${st};`;
    await sql.query(text);
    n++;
  }
  console.log(`Applied service_resource_booking_init.sql (${n} statements).`);

  const check = await sql.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('service_resource_venues', 'service_resource_bookings')
     ORDER BY table_name`
  );
  const names = Array.isArray(check)
    ? check.map((r: { table_name?: string }) => r.table_name).filter(Boolean)
    : [];
  if (names.length >= 2) {
    console.log("OK:", names.join(", "));
  } else {
    console.error("Warning: expected both tables; got:", names);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
