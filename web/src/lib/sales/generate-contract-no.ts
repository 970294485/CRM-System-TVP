import { desc, like } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import { salesContracts } from "@/db/schema";

/** contractDateYmd: YYYY-MM-DD → CT-yyyyMMdd-001 */
export async function generateNextContractNo(
  db: NeonHttpDatabase<typeof schema>,
  contractDateYmd: string
): Promise<string> {
  const compact = contractDateYmd.replace(/\D/g, "").slice(0, 8);
  const prefix = `CT-${compact}-`;
  const rows = await db
    .select({ contractNo: salesContracts.contractNo })
    .from(salesContracts)
    .where(like(salesContracts.contractNo, `${prefix}%`))
    .orderBy(desc(salesContracts.contractNo))
    .limit(1);

  let next = 1;
  const last = rows[0]?.contractNo;
  if (last) {
    const m = last.match(/-(\d+)\s*$/);
    if (m) next = parseInt(m[1]!, 10) + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}
