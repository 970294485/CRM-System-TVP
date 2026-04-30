import { z } from "zod";

function parseJsonObject(label: string, raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null || Array.isArray(v)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return v as Record<string, unknown>;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error(`Invalid ${label} JSON`);
    throw e;
  }
}

/** 由 multipart 欄位組裝並驗證（Zod） */
export const productMultipartSchema = z.object({
  sku: z.string().trim().min(1, "SKU 必填").max(255),
  name: z.string().trim().min(1, "名稱必填").max(500),
  category: z
    .string()
    .max(500)
    .transform((s) => {
      const t = s.trim();
      return t === "" ? undefined : t;
    }),
  base_price: z
    .string()
    .optional()
    .superRefine((val, ctx) => {
      const t = (val ?? "").trim();
      if (t === "") return;
      const n = Number(t);
      if (!Number.isFinite(n)) {
        ctx.addIssue({ code: "custom", message: "基礎售價必須為數字" });
      }
    })
    .transform((val) => {
      const t = (val ?? "").trim();
      if (t === "") return null;
      return Number(t);
    }),
  description: z.string().max(200_000).optional().default(""),
  attributes: z.string().transform((s) => parseJsonObject("attributes", s.trim() || "{}")),
  specifications: z.string().transform((s) => parseJsonObject("specifications", s.trim() || "{}")),
  is_active: z
    .string()
    .optional()
    .transform((s) => {
      const v = (s ?? "true").toLowerCase();
      return v !== "false" && v !== "0" && v !== "off";
    }),
});

export type ProductMultipartInput = z.infer<typeof productMultipartSchema>;
