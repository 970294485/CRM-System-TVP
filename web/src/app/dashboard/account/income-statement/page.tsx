import { IncomeStatementWorkspace } from "@/components/accounting/income-statement-workspace";
import { ensureAccountingCompanySettingsRow } from "@/actions/accounting-basics";

export default async function IncomeStatementPage() {
  const settingsRow = await ensureAccountingCompanySettingsRow();

  return (
    <div className="max-w-[1200px] space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">利潤表</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          依業務單據日彙總簡式損益：合同認列營業收入、採購單認列進貨成本，並以人事底薪合計為每月固定費用參考；支援按月、季與年度檢視。
        </p>
      </header>

      <IncomeStatementWorkspace initialYear={settingsRow.currentFiscalYear} />
    </div>
  );
}
