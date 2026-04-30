import { Suspense } from "react";

import { ExpenditureBudgetWorkspace } from "@/components/finance/expenditure-budget-workspace";
import { auth } from "@/auth";
import { canEditFinance } from "@/lib/authz";

export default async function BudgetControlPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">預算收支智能管控</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          設定各月「採購支出」上限並選擇是否啟用強控：啟用後，模組 8 透過批次匯入建立採購單時，若該月採購單金額累計（依 po_date）加上本批將超過上限，系統拒絕匯入；具 <code className="text-xs">super_admin</code> 角色者可繞過。已建採購單金額即時顯示於此，便於調整上限或與「高效財務分析」「月度預算統計」並讀。
        </p>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">您目前無財務編輯權限，僅可檢視各月承諾與預算設定。</p>
        ) : null}
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">載入中…</p>}>
        <ExpenditureBudgetWorkspace editable={editable} />
      </Suspense>
    </div>
  );
}
