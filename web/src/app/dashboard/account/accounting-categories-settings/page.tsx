import Link from "next/link";

import { AccountingManagementPanel } from "@/components/settings/accounting-management-panel";
import { auth } from "@/auth";
import { loadAccountingCategoriesAndItems } from "@/lib/accounting/load-accounting-management-data";
import { canEditSettings } from "@/lib/authz";

export default async function AccountingCategoriesSettingsPage() {
  const session = await auth();
  const editable = canEditSettings(session);
  const { categories, items } = await loadAccountingCategoriesAndItems();

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">入賬類別和項目設定</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          對應會計管理模組之科目表（COA）維護：五大類型下之母類別與明細項目，供總賬分錄、會計錄入與業務模組引用同一主檔。
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/accounting-entry">
            PT — 會計相關錄入
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/account/general-ledger">
            總賬
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/accounting">
            會計管理「入賬類別與項目」（同資料）
          </Link>
        </div>
        {!editable ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">您目前無設定編輯權限，下列以唯讀顯示。</p>
        ) : null}
      </header>

      <AccountingManagementPanel editable={editable} categories={categories} items={items} />
    </div>
  );
}
