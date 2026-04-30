import type { InferSelectModel } from "drizzle-orm";

import type { products } from "@/db/schema";

export type ProductListItem = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  basePrice: string | null;
  isActive: boolean;
  createdAtIso: string;
  imageCount: number;
  /** 第一張圖（相對路徑），列表縮圖用 */
  thumbUrl: string | null;
  descriptionPreview: string;
};

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toProductListItem(row: InferSelectModel<typeof products>): ProductListItem {
  const created = row.createdAt;
  const createdAtIso =
    created instanceof Date ? created.toISOString() : typeof created === "string" ? created : "";

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category ?? null,
    basePrice: row.basePrice != null ? String(row.basePrice) : null,
    isActive: row.isActive,
    createdAtIso,
    imageCount: row.imageUrls?.length ?? 0,
    thumbUrl: row.imageUrls?.[0] ?? null,
    descriptionPreview: stripHtml(row.description ?? "").slice(0, 100),
  };
}
