/**
 * 套用 sql/sales_finance_commission.sql
 * web/: npm run db:apply:sales-finance-commission
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
  const path = resolve(process.cwd(), "sql", "sales_finance_commission.sql");
  const file = readFileSync(path, "utf8");
  const statements = splitSqlStatements(file);
  for (const st of statements) {
    const text = st.endsWith(";") ? st : `${st};`;
    await sql.query(text);
  }
  console.log(`Applied sales_finance_commission.sql (${statements.length} statements).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
