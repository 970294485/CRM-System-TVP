import { z } from "zod";

export const PT_ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Revenue", "Expense"] as const;
export type PtAccountType = (typeof PT_ACCOUNT_TYPES)[number];

export const ptAccountingCategoryLabels: Record<PtAccountType, string> = {
  Asset: "資產",
  Liability: "負債",
  Equity: "權益",
  Revenue: "收入",
  Expense: "支出",
};

export const ptAccountingCategoryCreateSchema = z.object({
  category_code: z.string().trim().min(1, "科目代碼必填").max(64),
  category_name: z.string().trim().min(1, "科目名稱必填").max(255),
  account_type: z.enum(PT_ACCOUNT_TYPES),
  description: z.string().max(50_000).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  sort_order: z.number().int().min(0).max(999_999).optional(),
});

export type PtAccountingCategoryCreateInput = z.infer<typeof ptAccountingCategoryCreateSchema>;

/** 更新科目（可一併修改代碼；若與他筆重複則 409） */
export const ptAccountingCategoryUpdateSchema = z.object({
  category_code: z.string().trim().min(1, "科目代碼必填").max(64),
  category_name: z.string().trim().min(1, "科目名稱必填").max(255),
  account_type: z.enum(PT_ACCOUNT_TYPES),
  description: z.string().max(50_000).optional().nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(999_999).optional(),
});

export type PtAccountingCategoryUpdateInput = z.infer<typeof ptAccountingCategoryUpdateSchema>;
