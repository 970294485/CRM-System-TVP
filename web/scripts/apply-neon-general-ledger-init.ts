/**
 * 套用 sql/general_ledger_init.sql（總賬憑證表）
 * web/: npm run db:apply:general-ledger-init
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

async function main() {
  const url = sanitizeDatabaseUrl(raw!.charCodeAt(0) === 0xfeff ? raw!.slice(1).trim() : raw!);
  const sql = neon(url);
  const path = resolve(process.cwd(), "sql", "general_ledger_init.sql");
  const file = readFileSync(path, "utf8");
  const statements = splitSqlStatements(file);
  for (const st of statements) {
    const text = st.endsWith(";") ? st : `${st};`;
    await sql.query(text);
  }
  console.log(`Applied general_ledger_init.sql (${statements.length} statements).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
