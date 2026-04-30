/** 單列明細（由 JSON 明細陣列正規化，供表格／摘要顯示） */
export type DocumentLineDisplay = {
  name: string;
  sku: string | null;
  qty: number;
  price: number;
  lineTotal: number;
};

export function formatLineMoney(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeOneLine(raw: unknown): DocumentLineDisplay | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const qty = Number(o.qty);
  const unit =
    o.unit_price != null && Number.isFinite(Number(o.unit_price))
      ? Number(o.unit_price)
      : o.price != null && Number.isFinite(Number(o.price))
        ? Number(o.price)
        : NaN;
  if (!Number.isFinite(qty) || !Number.isFinite(unit)) return null;
  const sku =
    o.sku === null || o.sku === undefined ? null : String(o.sku).trim() === "" ? null : String(o.sku);
  const discount = o.discount != null && Number.isFinite(Number(o.discount)) ? Number(o.discount) : 0;
  const lineFromJson = o.line_total != null && Number.isFinite(Number(o.line_total)) ? Number(o.line_total) : null;
  const lineTotal =
    lineFromJson != null
      ? lineFromJson
      : Math.round(qty * unit * (1 - Math.min(100, Math.max(0, discount)) / 100) * 100) / 100;
  return { name, sku, qty, price: unit, lineTotal };
}

/** 將資料庫中的 items 轉成可列表顯示的列（略過無法解析的物件） */
export function normalizeDocumentLines(items: unknown): DocumentLineDisplay[] {
  if (!Array.isArray(items)) return [];
  const out: DocumentLineDisplay[] = [];
  for (const el of items) {
    const line = normalizeOneLine(el);
    if (line) out.push(line);
  }
  return out;
}

export function parseDocumentItemsJsonText(text: string): DocumentLineDisplay[] {
  const t = text.trim();
  if (!t) return [];
  try {
    const j = JSON.parse(t) as unknown;
    return normalizeDocumentLines(j);
  } catch {
    return [];
  }
}

function fallbackItemsString(v: unknown, maxLen = 200): string {
  if (v == null) return "—";
  if (typeof v === "string") {
    return v.length > maxLen ? `${v.slice(0, maxLen)}…` : v;
  }
  try {
    const j = JSON.stringify(v);
    return j.length > maxLen ? `${j.slice(0, maxLen)}…` : j;
  } catch {
    return "—";
  }
}

/** 供表格 cell 的 title／tooltip */
export function lineItemsToTooltipSummary(items: unknown): string {
  const lines = normalizeDocumentLines(items);
  if (lines.length > 0) {
    return lines
      .map(
        (l) =>
          `${l.name}${l.sku ? ` [${l.sku}]` : ""} ×${l.qty} 單價 ${formatLineMoney(l.price)} 小計 ${formatLineMoney(l.lineTotal)}`,
      )
      .join("\n");
  }
  return fallbackItemsString(items, 300);
}
