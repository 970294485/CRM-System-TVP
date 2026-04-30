import { getNeonSql } from "@/db";
import type { QuotationLineItem } from "@/db/schema";

/** Neon `sql.query` 可能回傳陣列或 `{ rows }`，供 API 降級路徑共用 */
export function normalizeNeonRows<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && "rows" in raw && Array.isArray((raw as { rows: unknown }).rows)) {
    return (raw as { rows: T[] }).rows;
  }
  return [];
}

/** 與 GET /api/sales/quotations 列表項目形狀一致（擴充欄位在舊表上為 null） */
export type SalesQuotationListItem = {
  id: string;
  quoteNo: string;
  customerId: string | null;
  customerName: string;
  customerCode: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  quoteDate: string;
  validUntil: string | null;
  items: unknown;
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  status: string;
  notes: string | null;
};

type RawListRow = {
  id: string;
  quote_no: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  quote_date: string;
  items: unknown;
  total_amount: string | number;
  status: string;
  join_name: string | null;
};

/**
 * 僅使用 documents-init 建立之 quotations 基底欄位（不含 valid_until / subtotal 等），
 * 供 Drizzle 因缺欄失敗時降級查詢。
 */
export async function listQuotationsViaLegacySql(customerId?: string): Promise<SalesQuotationListItem[]> {
  const sql = getNeonSql();
  const orderBy = `ORDER BY q.quote_date DESC NULLS LAST, q.quote_no ASC`;
  const body = `
    SELECT
      q.id,
      q.quote_no,
      q.customer_id,
      q.customer_name,
      q.customer_phone,
      q.customer_email,
      q.quote_date::text AS quote_date,
      q.items,
      q.total_amount::text AS total_amount,
      q.status,
      c.name AS join_name
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
  `;
  const raw = customerId
    ? await sql.query(`${body} WHERE q.customer_id = $1::uuid ${orderBy}`, [customerId])
    : await sql.query(`${body} ${orderBy}`, []);

  const rows = normalizeNeonRows<RawListRow>(raw);

  return rows.map((row) => ({
    id: row.id,
    quoteNo: row.quote_no,
    customerId: row.customer_id,
    customerName: row.join_name ?? row.customer_name,
    customerCode: null,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    quoteDate: row.quote_date,
    validUntil: null,
    items: row.items as QuotationLineItem[],
    subtotal: null,
    taxRate: null,
    taxAmount: null,
    totalAmount: String(row.total_amount),
    status: row.status,
    notes: null,
  }));
}

type RawDetailRow = RawListRow;

/** 單筆報價（舊表欄位） */
export async function getQuotationByIdViaLegacySql(id: string): Promise<SalesQuotationListItem | null> {
  const sql = getNeonSql();
  const raw = await sql.query(
    `
    SELECT
      q.id,
      q.quote_no,
      q.customer_id,
      q.customer_name,
      q.customer_phone,
      q.customer_email,
      q.quote_date::text AS quote_date,
      q.items,
      q.total_amount::text AS total_amount,
      q.status,
      c.name AS join_name
    FROM quotations q
    LEFT JOIN customers c ON c.id = q.customer_id
    WHERE q.id = $1::uuid
    LIMIT 1
  `,
    [id]
  );
  const rows = normalizeNeonRows<RawDetailRow>(raw);

  if (rows.length === 0) return null;
  const row = rows[0]!;
  return {
    id: row.id,
    quoteNo: row.quote_no,
    customerId: row.customer_id,
    customerName: row.join_name ?? row.customer_name,
    customerCode: null,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    quoteDate: row.quote_date,
    validUntil: null,
    items: row.items as QuotationLineItem[],
    subtotal: null,
    taxRate: null,
    taxAmount: null,
    totalAmount: String(row.total_amount),
    status: row.status,
    notes: null,
  };
}

export function isQuotationsSchemaMissingError(msg: string): boolean {
  return /does not exist/i.test(msg) && /quotation/i.test(msg);
}
