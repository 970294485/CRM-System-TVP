/** Wall-clock date parts in Asia/Hong_Kong（文件編號日期段／逐年換年基準）。 */

export const PT_DOCUMENT_TIME_ZONE = "Asia/Hong_Kong";

export function getHongKongYmd(reference = new Date()): {
  yyyy: number;
  mm: number;
  yyyyMM: string;
} {
  const s = reference
    .toLocaleString("sv-SE", { timeZone: PT_DOCUMENT_TIME_ZONE, hour12: false })
    .slice(0, 10);
  const [y, mo] = s.split("-").map((x) => parseInt(x, 10));
  return {
    yyyy: y,
    mm: mo,
    yyyyMM: `${y}${String(mo).padStart(2, "0")}`,
  };
}
