import { asc } from "drizzle-orm";
import { z } from "zod";

import { SalesBillingManagement } from "@/components/customers/sales-billing-management";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { canEditSales } from "@/lib/authz";

export default async function SalesBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await auth();
  const editable = canEditSales(session);
  const { customerId: rawCustomerId } = await searchParams;
  const idParsed = rawCustomerId ? z.string().uuid().safeParse(rawCustomerId) : { success: false as const };
  const initialCustomerId = idParsed.success ? idParsed.data : null;

  const db = getDb();
  const customerOptions = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .orderBy(asc(customers.name))
    .limit(1000);

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">銷售開單管理</h1>
      <p className="mb-8 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
        依《客戶管理》規格匯總商務單據：報價單與客戶關聯一覽；銷售合同與預收發票將於模組 3／模組 1
        串接後擴充。流程參考：M9 權限 → M8 主數據 → M6 客戶 → M3 銷售 → M1 財務。
      </p>
      <SalesBillingManagement customers={customerOptions} initialCustomerId={initialCustomerId} editable={editable} />
    </div>
  );
}
