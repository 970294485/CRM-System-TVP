import { z } from "zod";

export const IMPORT_DOCUMENT_TYPES = ["QUOTATION", "PURCHASE_ORDER", "INVENTORY"] as const;
export type ImportDocumentType = (typeof IMPORT_DOCUMENT_TYPES)[number];

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "日期須為 YYYY-MM-DD");

function parseJsonIfString(v: unknown): unknown {
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return [];
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return v;
    }
  }
  return v;
}

const quotationItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "明細須有 name"),
  sku: z.string().optional().nullable(),
  qty: z.coerce.number(),
  price: z.coerce.number(),
  specs: z.unknown().optional(),
});

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : String(v).trim()),
  z.string().uuid().optional()
);

export const quotationImportRowSchema = z.object({
  quote_no: z.string().trim().min(1, "quote_no 必填"),
  /** 選填：已建檔客戶可填 UUID；新客戶可留空，僅填 customer_name */
  customer_id: optionalUuid,
  /** 必填：客戶稱呼／名稱（新客戶或未連結主檔時作為權威顯示名；已建檔客戶亦建議填寫作報價快照） */
  customer_name: z.string().trim().min(1, "customer_name 必填"),
  customer_phone: z.string().trim().optional().nullable(),
  customer_email: z.string().trim().optional().nullable(),
  total_amount: z.coerce.number().finite(),
  quote_date: isoDate,
  items: z.preprocess(parseJsonIfString, z.array(quotationItemSchema).min(1, "至少一筆明細")),
  status: z.string().trim().optional(),
});

const poLineSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "明細須有 name"),
  sku: z.string().optional().nullable(),
  qty: z.coerce.number(),
  price: z.coerce.number(),
  specifications: z.unknown().optional(),
  warehouse_location: z.string().trim().optional().nullable(),
});

export const purchaseOrderImportRowSchema = z.object({
  po_no: z.string().trim().min(1, "po_no 必填"),
  original_system_id: z.string().trim().optional().nullable(),
  /** 選填：已建檔客戶／供應商 UUID */
  customer_id: optionalUuid,
  /** 選填：採購對象名稱快照 */
  customer_name: z.string().trim().optional().nullable(),
  customer_phone: z.string().trim().optional().nullable(),
  customer_email: z.string().trim().optional().nullable(),
  total_amount: z.coerce.number().finite(),
  items: z.preprocess(parseJsonIfString, z.array(poLineSchema).min(1, "至少一筆明細")),
  po_date: isoDate,
  status: z.string().trim().optional(),
  payment_status: z.enum(["Unpaid", "Partial", "Paid"]).optional(),
  paid_amount: z.coerce.number().finite().optional(),
});

export const inventoryImportRowSchema = z.object({
  product_id: z.string().uuid("product_id 須為 UUID"),
  sku: z.string().trim().min(1, "sku 必填"),
  warehouse_location: z.string().trim().optional().nullable(),
  stock_qty: z.coerce.number().int(),
  unit_cost: z.coerce.number().finite().optional().nullable(),
  last_counted_date: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : String(v).trim()),
    isoDate.optional()
  ),
});

export const importDocumentsRequestSchema = z.discriminatedUnion("documentType", [
  z.object({
    documentType: z.literal("QUOTATION"),
    rows: z.array(quotationImportRowSchema).min(1, "至少一筆資料"),
  }),
  z.object({
    documentType: z.literal("PURCHASE_ORDER"),
    rows: z.array(purchaseOrderImportRowSchema).min(1, "至少一筆資料"),
  }),
  z.object({
    documentType: z.literal("INVENTORY"),
    rows: z.array(inventoryImportRowSchema).min(1, "至少一筆資料"),
  }),
]);

export type ImportDocumentsRequest = z.infer<typeof importDocumentsRequestSchema>;

export type RowValidationError = { row: number; message: string };

export function validateRowsUniqueField<T extends Record<string, unknown>>(
  rows: T[],
  key: keyof T,
  label: string
): RowValidationError | null {
  const seen = new Map<string, number>();
  for (let i = 0; i < rows.length; i += 1) {
    const v = rows[i]![key];
    const s = v != null ? String(v).trim() : "";
    if (!s) continue;
    if (seen.has(s)) {
      return { row: i + 1, message: `${label}「${s}」與第 ${seen.get(s)! + 1} 列重複` };
    }
    seen.set(s, i);
  }
  return null;
}
