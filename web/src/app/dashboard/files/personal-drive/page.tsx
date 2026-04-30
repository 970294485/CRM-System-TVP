import { auth } from "@/auth";
import { DocumentClassificationManager } from "@/components/files/DocumentClassificationManager";
import { canManageDocuments } from "@/lib/authz";

export default async function PersonalDrivePage() {
  const session = await auth();
  const editable = canManageDocuments(session);
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">個人網盤</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">請先登入以使用個人網盤。</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">個人網盤</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        僅顯示 PERSONAL_DRIVE 且擁有者為目前登入帳號的檔案。種子測試列「測試-產品型錄」等僅在「文件分類」頁；個人網盤示範列綁定開發帳號{" "}
        <span className="font-mono text-zinc-800 dark:text-zinc-200">admin@example.com</span>。
      </p>
      <DocumentClassificationManager editable={editable} mode="personal" personalUserId={userId} />
    </div>
  );
}
