import { z } from "zod";

export const DATA_IMPORT_TYPES = ["QUOTATION", "PO", "INVENTORY"] as const;
export type DataImportType = (typeof DATA_IMPORT_TYPES)[number];

export const dataImportRequestSchema = z.object({
  importType: z.enum(DATA_IMPORT_TYPES),
  rows: z.array(z.record(z.string(), z.unknown())).min(1, "至少需要一筆資料"),
});

export type DataImportRequestInput = z.infer<typeof dataImportRequestSchema>;

export type RowValidationError = { row: number; message: string };

function normalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    const key = k.trim();
    if (!key) continue;
    if (v === null || v === undefined) out[key] = "";
    else out[key] = String(v).trim();
  }
  return out;
}

function isEffectivelyEmpty(normalized: Record<string, string>): boolean {
  return Object.values(normalized).every((v) => v === "");
}

/** 報價匯入（完整業務表後續對接；目前驗證非空列與預留欄位提示） */
const quotationRowSchema = z
  .record(z.string(), z.string())
  .refine((o) => !isEffectivelyEmpty(o), "空白列");

/** 採購單匯入 */
const poRowSchema = z
  .record(z.string(), z.string())
  .refine((o) => !isEffectivelyEmpty(o), "空白列");

/** 庫存匯入 */
const inventoryRowSchema = z
  .record(z.string(), z.string())
  .refine((o) => !isEffectivelyEmpty(o), "空白列");

const importRowSchemas: Record<DataImportType, z.ZodType<Record<string, string>>> = {
  QUOTATION: quotationRowSchema,
  PO: poRowSchema,
  INVENTORY: inventoryRowSchema,
};

export function validateImportRow(
  importType: DataImportType,
  row: Record<string, unknown>,
  /** 1-based 資料列號（不含表頭） */
  rowNumber: number
): { ok: true; data: Record<string, string> } | { ok: false; error: RowValidationError } {
  const normalized = normalizeRow(row);
  const parsed = importRowSchemas[importType].safeParse(normalized);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((issue) => issue.message).join("；") || "格式錯誤";
    return { ok: false, error: { row: rowNumber, message: msg } };
  }
  return { ok: true, data: parsed.data };
}
