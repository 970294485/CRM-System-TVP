/**
 * 套用 sql/system_document_personal_shares_init.sql
 * web/: npm run db:apply:personal-shares-init
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const sql = getNeonSql();
  const path = resolve(process.cwd(), "sql", "system_document_personal_shares_init.sql");
  const file = readFileSync(path, "utf8");
  const statements = file
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const st of statements) {
    await sql.query(`${st};`);
  }

  console.log(`Applied system_document_personal_shares_init.sql (${statements.length} statements).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
