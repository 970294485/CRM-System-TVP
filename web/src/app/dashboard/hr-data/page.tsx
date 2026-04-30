import { auth } from "@/auth";
import { DataImportTool } from "@/components/data-import/DataImportTool";
import { EmployeeSettingsManager } from "@/components/hr/employee-settings-manager";
import { canEditSettings } from "@/lib/authz";

export default async function HrDataPage() {
  const session = await auth();
  const editable = canEditSettings(session);

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">人事數據管理</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        維護員工薪資與考勤設置；並可將 CSV 批量匯入暫存（報價／採購／庫存類型由匯入類型區分）。
      </p>

      <div className="space-y-8">
        <EmployeeSettingsManager editable={editable} />
        <DataImportTool editable={editable} />
      </div>
    </div>
  );
}
