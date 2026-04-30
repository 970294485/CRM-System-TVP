/**
 * 套用 sql/quotations_po_inventory_init.sql
 * web/: npm run db:apply:documents-init
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { resolve } from "path";

import { sanitizeDatabaseUrl } from "../src/db/sanitize-database-url";
import { splitSqlStatements } from "./sql-split";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const raw = process.env.DATABASE_URL?.trim();
if (!raw) {
  console.error("DATABASE_URL is empty — check web/.env.local");
  process.exit(1);
}
const DATABASE_URL = raw;

async function main() {
  const url = sanitizeDatabaseUrl(DATABASE_URL.charCodeAt(0) === 0xfeff ? DATABASE_URL.slice(1).trim() : DATABASE_URL);
  const sql = neon(url);
  const sqlFiles = [
    "quotations_po_inventory_init.sql",
    "quotations_optional_customer_alter.sql",
    "purchase_order_receipts_init.sql",
    "purchase_orders_customer_columns.sql",
    "quotations_sales_management_alter.sql",
  ] as const;
  let total = 0;
  for (const fileName of sqlFiles) {
    const path = resolve(process.cwd(), "sql", fileName);
    const file = readFileSync(path, "utf8");
    const statements = splitSqlStatements(file);
    let n = 0;
    for (const st of statements) {
      const text = st.endsWith(";") ? st : `${st};`;
      await sql.query(text);
      n++;
    }
    total += n;
    console.log(`Applied ${fileName} (${n} statements).`);
  }
  console.log(`Done (${total} statements total).`);

  const check = await sql.query(
    `SELECT 1 AS ok FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'quotations'
     LIMIT 1`
  );
  if (Array.isArray(check) && check.length > 0) {
    console.log("OK: table quotations exists.");
  } else {
    console.error("Warning: quotations table still not visible.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
