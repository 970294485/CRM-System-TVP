import Link from "next/link";

import { auth } from "@/auth";
import { AccountingCategoryManager } from "@/components/accounting/accounting-category-manager";
import { canEditFinance } from "@/lib/authz";

export default async function AccountingEntryPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl">
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">會計相關錄入</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        PT-Data Entry：維護會計科目代碼、五大類別（資產／負債／權益／收入／支出）與說明；資料寫入與「入賬類別與項目」共用資料表{" "}
        <code className="rounded bg-zinc-200/80 px-1 text-xs dark:bg-zinc-800">accounting_categories</code>
        （欄位：category_code、account_type 等）。
        {!editable ? " 您目前無財務編輯權限，僅可檢視列表。" : null}
      </p>

      <AccountingCategoryManager editable={editable} />

      <p className="mt-10 text-sm text-zinc-600 dark:text-zinc-400">
        需要維護入賬項目與舊版類別時，請至{" "}
        <Link href="/dashboard/accounting" className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-400">
          入賬類別與項目
        </Link>
        。
      </p>
    </div>
  );
}
