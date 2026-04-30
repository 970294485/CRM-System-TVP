import { z } from "zod";

export const documentCategoryCreateSchema = z.object({
  name: z.string().trim().min(1, "請輸入分類名稱").max(256),
  description: z.string().trim().max(512).optional().nullable(),
});

export type DocumentCategoryCreateInput = z.infer<typeof documentCategoryCreateSchema>;

const uuidLike = z.string().uuid();

export function parseOptionalEntityId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const ok = uuidLike.safeParse(t);
  return ok.success ? ok.data : null;
}
