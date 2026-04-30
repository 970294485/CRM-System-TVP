import { Suspense } from "react";

import { FinancialAnalyticsWorkspace } from "@/components/finance/financial-analytics-workspace";
import { auth } from "@/auth";
import { canEditFinance } from "@/lib/authz";

export default async function FinancialAnalyticsPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">高效財務分析工具</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          彙總模組 1 與關聯銷售合同、採購單數據：應收（合同總額扣已確認預收款）、應付（採購總額扣已付）、草稿請款與預收、以及「待收 vs 待付」淨頭寸作為營運資金參考。數據即時從資料庫計算，不含外部銀行流水；可與「月度預算統計」已確認口徑並讀。
        </p>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">您目前無財務編輯權限時仍可檢視本分析。</p>
        ) : null}
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">載入中…</p>}>
        <FinancialAnalyticsWorkspace />
      </Suspense>
    </div>
  );
}
