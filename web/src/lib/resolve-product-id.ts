import { getNeonSql } from "@/db";

function isUuid(s: string): boolean {
  return /^[0-9a-f-]{36}$/i.test(s);
}

/** 由明細的 product_id 或 sku 解析 products.id；無法解析則 null */
export async function resolveProductIdForLine(
  sql: ReturnType<typeof getNeonSql>,
  line: { product_id?: string | null; sku?: string | null }
): Promise<string | null> {
  const rawPid = line.product_id?.trim();
  if (rawPid && isUuid(rawPid)) {
    const ok = await sql.query(`SELECT 1 AS ok FROM products WHERE id = $1::uuid LIMIT 1`, [rawPid]);
    if (Array.isArray(ok) && ok.length > 0) return rawPid;
  }
  const sku = line.sku?.trim();
  if (sku) {
    const rows = await sql.query(`SELECT id::text AS id FROM products WHERE sku = $1 LIMIT 1`, [sku]);
    if (Array.isArray(rows) && rows[0]) return (rows[0] as { id: string }).id;
  }
  return null;
}
