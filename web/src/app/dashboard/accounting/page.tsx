import { AccountingManagementPanel } from "@/components/settings/accounting-management-panel";
import { auth } from "@/auth";
import { loadAccountingCategoriesAndItems } from "@/lib/accounting/load-accounting-management-data";
import { canEditSettings } from "@/lib/authz";

export default async function AccountingPage() {
  const session = await auth();
  const editable = canEditSettings(session);
  const { categories, items } = await loadAccountingCategoriesAndItems();

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">入賬類別與項目</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        對應模組 8 會計錄入：以表格維護類別與項目，並透過按鈕與彈窗進行查看與編輯。會計管理下路徑請見「入賬類別和項目設定」。
      </p>

      <AccountingManagementPanel editable={editable} categories={categories} items={items} />
    </div>
  );
}
