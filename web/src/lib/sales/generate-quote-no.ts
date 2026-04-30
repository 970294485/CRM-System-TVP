import { desc, like } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import { quotations } from "@/db/schema";

/** quoteDateYmd: YYYY-MM-DD → QT-yyyyMMdd-001 */
export async function generateNextQuoteNo(
  db: NeonHttpDatabase<typeof schema>,
  quoteDateYmd: string
): Promise<string> {
  const compact = quoteDateYmd.replace(/\D/g, "").slice(0, 8);
  const prefix = `QT-${compact}-`;
  const rows = await db
    .select({ quoteNo: quotations.quoteNo })
    .from(quotations)
    .where(like(quotations.quoteNo, `${prefix}%`))
    .orderBy(desc(quotations.quoteNo))
    .limit(1);

  let next = 1;
  const last = rows[0]?.quoteNo;
  if (last) {
    const m = last.match(/-(\d+)\s*$/);
    if (m) next = parseInt(m[1]!, 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}
