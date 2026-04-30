import { desc } from "drizzle-orm";

import { auth } from "@/auth";
import { ProductEntryPanel } from "@/components/products/product-entry-panel";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import { toProductListItem } from "@/lib/product-list";

export default async function ProductEntryPage() {
  const session = await auth();
  const editable = canEditSales(session);
  const db = getDb();
  const rows = await db.select().from(products).orderBy(desc(products.createdAt));
  const initialProducts = rows.map(toProductListItem);

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">產品與服務輸入</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        以表格檢視產品主檔；具權限者可點「新增產品」於彈窗中填寫並儲存。
        {!editable ? " 您目前為唯讀權限，無法新增。" : null}
      </p>
      <ProductEntryPanel initialProducts={initialProducts} editable={editable} />
    </div>
  );
}
