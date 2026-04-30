import { asc } from "drizzle-orm";

import type { AccountingCategoryDTO, AccountingItemDTO } from "@/components/settings/accounting-management-panel";
import { getDb } from "@/db";
import { accountingCategories, accountingItems } from "@/db/schema";

/** 入賬類別／項目（與 PT「會計相關錄入」共用表） */
export async function loadAccountingCategoriesAndItems(): Promise<{
  categories: AccountingCategoryDTO[];
  items: AccountingItemDTO[];
}> {
  const db = getDb();

  const categoriesRows = await db
    .select()
    .from(accountingCategories)
    .orderBy(asc(accountingCategories.sortOrder), asc(accountingCategories.categoryCode));

  const itemsRows = await db.select().from(accountingItems).orderBy(asc(accountingItems.sortOrder), asc(accountingItems.code));

  const catRank = new Map(categoriesRows.map((c, i) => [c.id, i]));
  const sortedItems = [...itemsRows].sort((a, b) => {
    const ra = catRank.get(a.categoryId) ?? 999;
    const rb = catRank.get(b.categoryId) ?? 999;
    if (ra !== rb) return ra - rb;
    return a.sortOrder - b.sortOrder || a.code.localeCompare(b.code);
  });

  const categories: AccountingCategoryDTO[] = categoriesRows.map((c) => ({
    id: c.id,
    code: c.categoryCode,
    name: c.categoryName,
    type: c.accountType,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    itemCount: itemsRows.filter((i) => i.categoryId === c.id).length,
  }));

  const items: AccountingItemDTO[] = sortedItems.map((i) => {
    const cat = categoriesRows.find((c) => c.id === i.categoryId);
    return {
      id: i.id,
      categoryId: i.categoryId,
      categoryLabel: cat ? `${cat.categoryCode} — ${cat.categoryName}` : i.categoryId,
      code: i.code,
      name: i.name,
      description: i.description,
      isActive: i.isActive,
      sortOrder: i.sortOrder,
    };
  });

  return { categories, items };
}
