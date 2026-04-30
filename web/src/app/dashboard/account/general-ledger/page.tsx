import { auth } from "@/auth";
import { GeneralLedgerWorkspace } from "@/components/accounting/general-ledger-workspace";
import { ensureAccountingCompanySettingsRow } from "@/actions/accounting-basics";
import { canEditFinance } from "@/lib/authz";

export default async function GeneralLedgerPage() {
  const session = await auth();
  const settingsRow = await ensureAccountingCompanySettingsRow();
  const canPostJournal = session?.user?.id ? canEditFinance(session) : false;

  return (
    <div className="max-w-[1400px] space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">總賬</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          會計科目樹、試算平衡表與手工記賬憑證（複式分錄）；科目主檔與「入賬類別與項目」共用。首次使用請執行{" "}
          <span className="font-mono text-zinc-800 dark:text-zinc-200">npm run db:apply:general-ledger-init</span>{" "}
          或套用 drizzle 0017 遷移。
        </p>
      </header>

      <GeneralLedgerWorkspace initialYear={settingsRow.currentFiscalYear} canPostJournal={canPostJournal} />
    </div>
  );
}
