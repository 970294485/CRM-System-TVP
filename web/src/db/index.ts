import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import { sanitizeDatabaseUrl } from "./sanitize-database-url";

function requireDatabaseUrl(): string {
  let raw = process.env.DATABASE_URL?.trim() ?? "";
  /* UTF-8 BOM from some editors breaks Neon URL parsing */
  if (raw.charCodeAt(0) === 0xfeff) {
    raw = raw.slice(1).trim();
  }
  if (!raw) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and paste your Neon connection string."
    );
  }
  const cleaned = sanitizeDatabaseUrl(raw);
  if (!/^postgres(ql)?:\/\//i.test(cleaned)) {
    throw new Error("DATABASE_URL must start with postgresql:// or postgres://");
  }
  return cleaned;
}

let cachedNeonSql: ReturnType<typeof neon> | null = null;
let cachedNeonForUrl: string | undefined;

export function getNeonSql(): ReturnType<typeof neon> {
  const url = requireDatabaseUrl();
  if (!cachedNeonSql || cachedNeonForUrl !== url) {
    cachedNeonSql = neon(url);
    cachedNeonForUrl = url;
    cachedDb = undefined;
  }
  return cachedNeonSql;
}

let cachedDb: NeonHttpDatabase<typeof schema> | undefined;

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!cachedDb) {
    cachedDb = drizzle(getNeonSql(), { schema }) as NeonHttpDatabase<typeof schema>;
  }
  return cachedDb;
}

export async function pingDatabase(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const sql = getNeonSql();
    await sql`SELECT 1`;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export { schema };
