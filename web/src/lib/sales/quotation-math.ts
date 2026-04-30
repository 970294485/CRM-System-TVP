import type { QuotationLineItem } from "@/db/schema";

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** 折扣為百分比 0–100 */
export function lineTotalFromInputs(qty: number, unitPrice: number, discountPct: number): number {
  const q = Number.isFinite(qty) ? qty : 0;
  const p = Number.isFinite(unitPrice) ? unitPrice : 0;
  const d = Math.min(100, Math.max(0, Number.isFinite(discountPct) ? discountPct : 0));
  return roundMoney(q * p * (1 - d / 100));
}

export function totalsFromLines(lineTotals: number[], taxRatePct: number) {
  const subtotal = roundMoney(lineTotals.reduce((a, x) => a + (Number.isFinite(x) ? x : 0), 0));
  const tr = Math.min(100, Math.max(0, Number.isFinite(taxRatePct) ? taxRatePct : 0));
  const tax_amount = roundMoney(subtotal * (tr / 100));
  const total_amount = roundMoney(subtotal + tax_amount);
  return { subtotal, tax_amount, total_amount };
}

/** 含稅總額反拆未稅與稅金（預收發票以預收款含稅總額為準） */
export function splitInclusiveTaxTotal(inclusiveTotal: number, taxRatePct: number) {
  const total_amount = roundMoney(Math.max(0, Number.isFinite(inclusiveTotal) ? inclusiveTotal : 0));
  const tr = Math.min(100, Math.max(0, Number.isFinite(taxRatePct) ? taxRatePct : 0));
  const subtotal = roundMoney(total_amount / (1 + tr / 100));
  const tax_amount = roundMoney(total_amount - subtotal);
  return { subtotal, tax_amount, total_amount };
}

export function unitPriceFromLine(line: QuotationLineItem): number {
  const u = line.unit_price;
  const legacy = line.price;
  const n = u != null && Number.isFinite(Number(u)) ? Number(u) : legacy != null ? Number(legacy) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function discountPctFromLine(line: QuotationLineItem): number {
  const d = line.discount;
  if (d == null || !Number.isFinite(Number(d))) return 0;
  return Math.min(100, Math.max(0, Number(d)));
}

/** 正規化單筆明細並寫回 line_total（供 API 寫入前使用） */
export function normalizeLineForPersist(line: QuotationLineItem): QuotationLineItem {
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  const unit_price = unitPriceFromLine(line);
  const discount = discountPctFromLine(line);
  const line_total = lineTotalFromInputs(qty, unit_price, discount);
  return {
    ...line,
    qty,
    unit_price,
    discount,
    line_total,
  };
}

export function normalizeItemsForPersist(items: QuotationLineItem[]): QuotationLineItem[] {
  return items.filter((l) => typeof l.name === "string" && l.name.trim().length > 0).map(normalizeLineForPersist);
}

export const QUOTATION_STATUSES = ["Draft", "Sent", "Accepted", "Expired", "Converted", "Legacy_Imported"] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
