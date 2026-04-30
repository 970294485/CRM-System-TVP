import { ArApManagementWorkspace } from "@/components/accounting/ar-ap-management-workspace";

export default function ArApManagementPage() {
  return (
    <div className="max-w-[1600px] space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">賬款應收／應付管理</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          彙總銷售合同端應收與採購單端應付，並依文件日起算帳齡；口徑與財務分析一致，詳細入帳請配合預收款與請款流程。
        </p>
      </header>

      <ArApManagementWorkspace />
    </div>
  );
}
