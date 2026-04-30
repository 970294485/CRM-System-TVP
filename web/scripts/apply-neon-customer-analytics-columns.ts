/**
 * 套用 sql/customers_analytics_extend.sql
 * web/: npm run db:apply:customer-analytics
 */
import { config } from "dotenv";
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";
import { resolve } from "path";

import { sanitizeDatabaseUrl } from "../src/db/sanitize-database-url";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

let DATABASE_URL = process.env.DATABASE_URL?.trim() ?? "";
if (DATABASE_URL.charCodeAt(0) === 0xfeff) {
  DATABASE_URL = DATABASE_URL.slice(1).trim();
}
if (!DATABASE_URL) {
  console.error("DATABASE_URL is empty — check web/.env.local");
  process.exit(1);
}

function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let buf = "";
  let i = 0;
  let inLineComment = false;
  let inString = false;
  let dollarEnd: string | null = null;
  const len = sqlText.length;

  while (i < len) {
    const c = sqlText[i]!;

    if (inLineComment) {
      buf += c;
      if (c === "\n") inLineComment = false;
      i++;
      continue;
    }

    if (dollarEnd !== null) {
      if (sqlText.startsWith(dollarEnd, i)) {
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
      if (c === "'" && sqlText[i + 1] === "'") {
        buf += "'";
        i += 2;
        continue;
      }
      if (c === "'") inString = false;
      i++;
      continue;
    }

    if (c === "-" && sqlText[i + 1] === "-") {
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
      if (sqlText[i + 1] === "$") {
        dollarEnd = "$$";
        buf += "$$";
        i += 2;
        continue;
      }
      const rest = sqlText.slice(i);
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
  const sql = neon(sanitizeDatabaseUrl(DATABASE_URL));
  const path = resolve(process.cwd(), "sql", "customers_analytics_extend.sql");
  const file = readFileSync(path, "utf8");
  const statements = splitSqlStatements(file);
  let n = 0;
  for (const st of statements) {
    const text = st.endsWith(";") ? st : `${st};`;
    await sql.query(text);
    n++;
  }
  console.log(`Applied customers_analytics_extend.sql (${n} statements).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
