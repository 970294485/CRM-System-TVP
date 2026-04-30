import { z } from "zod";

const optionalUuid = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : String(v).trim()),
  z.string().uuid().optional()
);

export const customerServiceCategorySchema = z.enum([
  "inquiry",
  "complaint",
  "after_sales",
  "billing",
  "other",
]);

export const customerServiceChannelSchema = z.enum([
  "phone",
  "email",
  "line",
  "in_person",
  "online",
  "other",
]);

export const customerServiceStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);

export const customerServicePrioritySchema = z.enum(["low", "medium", "high"]);

export const customerServiceCaseCreateSchema = z
  .object({
    customer_id: optionalUuid,
    /** 未選主檔客戶時必填 */
    customer_name_snapshot: z.string().trim().optional(),
    title: z.string().trim().min(1, "請填寫主旨"),
    category: customerServiceCategorySchema.optional().default("inquiry"),
    channel: customerServiceChannelSchema.optional().default("other"),
    status: customerServiceStatusSchema.optional().default("open"),
    priority: customerServicePrioritySchema.optional().default("medium"),
    summary: z.string().trim().optional().nullable(),
    /** 建立時一併寫入第一則備註（選填） */
    initial_note: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.customer_id) {
      const name = data.customer_name_snapshot?.trim() ?? "";
      if (!name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "請選擇客戶或填寫客戶稱呼",
          path: ["customer_name_snapshot"],
        });
      }
    }
  });

export const customerServiceCasePatchSchema = z.object({
  title: z.string().trim().min(1).optional(),
  category: customerServiceCategorySchema.optional(),
  channel: customerServiceChannelSchema.optional(),
  status: customerServiceStatusSchema.optional(),
  priority: customerServicePrioritySchema.optional(),
  summary: z.string().trim().optional().nullable(),
});

export const customerServiceNoteCreateSchema = z.object({
  body: z.string().trim().min(1, "備註內容不可為空"),
});

export type CustomerServiceCaseCreateInput = z.infer<typeof customerServiceCaseCreateSchema>;
export type CustomerServiceCasePatchInput = z.infer<typeof customerServiceCasePatchSchema>;
