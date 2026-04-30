import { Suspense } from "react";

import { PaymentRequestsAdvancesWorkspace } from "@/components/finance/payment-requests-advances-workspace";
import { auth } from "@/auth";
import { canEditFinance } from "@/lib/authz";

export default async function PaymentRequestsAdvancesPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">管理請款單與預收款單</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          對應模組 1：應付請款單掛鉤採購單，於實際付款後「確認付款」以更新採購單已付金額；預收款單掛鉤銷售合同，登記入帳後「確認收款」，供後續合同／發票匹配使用。預收款列表會依合同左連接顯示預收發票號（一合同至多一張預收發票時與合同對應）。採購單列表（資料輸入／採購對接）可點「建立請款」跳轉至此並帶入採購單。本頁不執行外部匯款，僅記錄與狀態更新。
        </p>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">您目前無財務編輯權限，僅可檢視列表。</p>
        ) : null}
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">載入中…</p>}>
        <PaymentRequestsAdvancesWorkspace editable={editable} />
      </Suspense>
    </div>
  );
}
