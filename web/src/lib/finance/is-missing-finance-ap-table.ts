/**
 * 僅在明確為「finance_ap_payment_requests 這張 relation 不存在」時為 true。
 * 排除：column "…" of relation "…" does not exist（應回 500 並附 detail，勿誤導 db:apply）。
 */
export function isMissingFinanceApTableError(message: string): boolean {
  const m = message;
  if (!/finance_ap_payment_requests/i.test(m)) return false;

  // 欄位不存在時訊息也含 relation "…" does not exist，不可當成缺表
  if (/column\s+["'][^"']+["']\s+of\s+relation\s+["']?(?:public\.)?finance_ap_payment_requests/i.test(m)) {
    return false;
  }

  if (
    /relation\s+["']?(?:public\.)?finance_ap_payment_requests["']?\s+does\s+not\s+exist/i.test(m)
  ) {
    return true;
  }

  const lower = m.toLowerCase();
  if (lower.includes("42p01") && lower.includes("finance_ap_payment_requests")) {
    return true;
  }

  return false;
}
