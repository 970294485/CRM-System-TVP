/**
 * 套用 sql/document_classification_init.sql（建立文件分類相關表）
 * web/: npm run db:apply:document-classification-init
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";

import { getNeonSql } from "../src/db/index";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const sql = getNeonSql();
  const path = resolve(process.cwd(), "sql", "document_classification_init.sql");
  const file = readFileSync(path, "utf8");
  const statements = file
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const st of statements) {
    await sql.query(`${st};`);
  }

  console.log(`Applied document_classification_init.sql (${statements.length} statements).`);

  const check = await sql.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('document_categories', 'system_documents')
     ORDER BY table_name`
  );
  const names = Array.isArray(check) ? check.map((r: { table_name?: string }) => r.table_name).filter(Boolean) : [];
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
