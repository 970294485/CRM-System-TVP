import { Suspense } from "react";

import { MultiLevelApprovalWorkspace } from "@/components/finance/multi-level-approval-workspace";
import { auth } from "@/auth";
import { canEditFinance } from "@/lib/authz";

export default async function MultiLevelApprovalPage() {
  const session = await auth();
  const editable = canEditFinance(session);

  return (
    <div className="max-w-6xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">設置多層審批權限</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          設定應付請款（AP）依金額門檻之審批鏈結，並與模組 9 角色 slug 對齊。請在「管理請款單」依序簽署各階後，方可「確認付款」；<code className="text-xs">super_admin</code>{" "}
          可繞過審批直接確認。
        </p>
      </header>

      <Suspense fallback={<p className="text-sm text-zinc-500">載入中…</p>}>
        <MultiLevelApprovalWorkspace editable={editable} />
      </Suspense>
    </div>
  );
}
