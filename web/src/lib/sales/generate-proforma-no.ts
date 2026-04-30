import { desc, like } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import { proformaInvoices } from "@/db/schema";

/** issueDateYmd: YYYY-MM-DD → PF-yyyyMMdd-001 */
export async function generateNextProformaInvoiceNo(
  db: NeonHttpDatabase<typeof schema>,
  issueDateYmd: string
): Promise<string> {
  const compact = issueDateYmd.replace(/\D/g, "").slice(0, 8);
  const prefix = `PF-${compact}-`;
  const rows = await db
    .select({ invoiceNo: proformaInvoices.invoiceNo })
    .from(proformaInvoices)
    .where(like(proformaInvoices.invoiceNo, `${prefix}%`))
    .orderBy(desc(proformaInvoices.invoiceNo))
    .limit(1);

  let next = 1;
  const last = rows[0]?.invoiceNo;
  if (last) {
    const m = last.match(/-(\d+)\s*$/);
    if (m) next = parseInt(m[1]!, 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}
