import { Suspense } from "react";

import { MonthlyBudgetStatsWorkspace } from "@/components/finance/monthly-budget-stats-workspace";
import { auth } from "@/auth";
import { canEditFinance } from "@/lib/authz";

export default async function MonthlyBudgetStatisticsPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">月度預算統計功能</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          對應模組 1：以「已確認」單據為準，按自然月（UTC）彙總預收款入帳與應付請款出帳，並對照人事資料中在職員工底薪合計作為月度固定成本參考。後續可擴充：預算目標線、多部門拆分、合同核銷金額與預收的差異分析及導出。
        </p>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">您目前無財務編輯權限時仍可檢視本統計。</p>
        ) : null}
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">載入中…</p>}>
        <MonthlyBudgetStatsWorkspace />
      </Suspense>
    </div>
  );
}
