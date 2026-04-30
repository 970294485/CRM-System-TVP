import { Suspense } from "react";

import { ContractInvoiceAdvanceMatchingWorkspace } from "@/components/finance/contract-invoice-advance-matching-workspace";
import { auth } from "@/auth";
import { canEditFinance } from "@/lib/authz";

export default async function ContractInvoiceAdvanceMatchingPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">合同與發票預收款匹配</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          彙總銷售合同與預收發票維度下的預收進度（已確認／草稿），並支援將預收款單在同客戶範圍內改掛正確合同，與「管理請款單與預收款單」及銷售管理中的合同、預收發票資料連動。本頁不執行外部收款，僅供勾稽與調整掛鉤。
        </p>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">您目前無財務編輯權限，僅可檢視彙總與列表。</p>
        ) : null}
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">載入中…</p>}>
        <ContractInvoiceAdvanceMatchingWorkspace editable={editable} />
      </Suspense>
    </div>
  );
}
