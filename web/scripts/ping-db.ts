/**
 * Quick Neon connectivity check: npx tsx scripts/ping-db.ts
 */
import { config } from "dotenv";
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

async function main() {
  const url = sanitizeDatabaseUrl(raw as string);
  const sql = neon(url);
  await sql`SELECT 1`;
  console.log("Neon ping OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
