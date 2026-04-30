/**
 * 套用 sql/neon_migrate_accounting_categories.sql（不需開 Neon 網頁貼上）
 * web/: npx tsx scripts/apply-neon-accounting-migrate.ts
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { resolve } from "path";

import { sanitizeDatabaseUrl } from "../src/db/sanitize-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const raw = process.env.DATABASE_URL?.trim();
if (!raw) {
  console.error("DATABASE_URL is empty — check web/.env.local");
  process.exit(1);
}
/** Narrowed for nested `main()` (TS does not always carry module-level narrowing into closures). */
const DATABASE_URL = raw;

/** 依 `;` 切分，略過字串內與 `$$` / `$tag$` 區塊內的分號 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let i = 0;
  let inLineComment = false;
  let inString = false;
  let dollarEnd: string | null = null;
  const len = sql.length;

  while (i < len) {
    const c = sql[i];

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (dollarEnd !== null) {
      if (sql.startsWith(dollarEnd, i)) {
        buf += dollarEnd;
        i += dollarEnd.length;
        dollarEnd = null;
        continue;
      }
      buf += c;
      i++;
      continue;
    }

    if (inString) {
      buf += c;
      if (c === "'" && sql[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (c === "'") inString = false;
      i++;
      continue;
    }

    if (c === "-" && sql[i + 1] === "-") {
      inLineComment = true;
      buf += "--";
      i += 2;
      continue;
    }

    if (c === "'") {
      inString = true;
      buf += c;
      i++;
      continue;
    }

    if (c === "$") {
      if (sql[i + 1] === "$") {
        dollarEnd = "$$";
        buf += "$$";
        i += 2;
        continue;
      }
      const rest = sql.slice(i);
      const m = rest.match(/^\$([a-zA-Z_][a-zA-Z0-9_]*)\$/);
      if (m) {
        dollarEnd = m[0];
        buf += dollarEnd;
        i += dollarEnd.length;
        continue;
      }
    }

    if (c === ";") {
      const s = buf.trim();
      if (s.length > 0) statements.push(s);
      buf = "";
      i++;
      continue;
    }

    buf += c;
    i++;
  }
  const tail = buf.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function main() {
  const url = sanitizeDatabaseUrl(DATABASE_URL.charCodeAt(0) === 0xfeff ? DATABASE_URL.slice(1).trim() : DATABASE_URL);
  const sql = neon(url);
  const path = resolve(process.cwd(), "sql", "neon_migrate_accounting_categories.sql");
  const file = readFileSync(path, "utf8");
  const statements = splitSqlStatements(file);
  let n = 0;
  for (const st of statements) {
    const text = st.endsWith(";") ? st : `${st};`;
    await sql.query(text);
    n++;
  }
  console.log(`Applied neon_migrate_accounting_categories.sql (${n} statements).`);

  const check = await sql.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'accounting_categories' AND column_name = 'category_code'
     LIMIT 1`
  );
  if (Array.isArray(check) && check.length > 0) {
    console.log("OK: column category_code exists.");
  } else {
    console.error("Warning: category_code still not visible — check database / schema.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
