import type { InferSelectModel } from "drizzle-orm";

import type { numberSequences } from "@/db/schema";
import { getHongKongYmd } from "@/lib/hong-kong-time";

export type SequenceRow = InferSelectModel<typeof numberSequences>;

function normalizePrefix(p: string): string {
  return p.trim();
}

/** Assemble `{prefix}{-segment?}-{padded}-{suffix}`；日期段依 row.dateSegment、香港時區 wall clock。 */
export function formatDocumentSerial(
  seq: SequenceRow,
  serialInt: number,
  referenceDate: Date,
): string {
  const hk = getHongKongYmd(referenceDate);

  const seg = seq.dateSegment;

  let middle = "";
  if (seg === "year") middle = String(hk.yyyy);
  if (seg === "year_month") middle = hk.yyyyMM;

  const padded = String(serialInt).padStart(Math.max(1, seq.padLength ?? 6), "0");

  const pre = normalizePrefix(seq.prefix);
  const suf = normalizePrefix(seq.suffix);

  if (!middle) {
    return `${pre}${padded}${suf}`;
  }

  if (!pre) {
    return `${middle}-${padded}${suf}`;
  }

  const left = !/[-/.]$/.test(pre) ? `${pre}-` : pre;
  return `${left}${middle}-${padded}${suf}`;
}
