import { auth } from "@/auth";
import { CompanyDocumentCenter } from "@/components/files/CompanyDocumentCenter";
import { canManageUsers } from "@/lib/authz";

export default async function CompanyDocumentsPage() {
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const isAdmin = canManageUsers(session);

  if (!userId) {
    return <p className="text-sm text-amber-700 dark:text-amber-400">請先登入以使用公共文件數據庫。</p>;
  }

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">公共文件數據庫</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        企業級文檔庫（與文件分類／個人網盤資料表分離）；支援公開或內部受限，並可指定可存取的員工。
      </p>
      <CompanyDocumentCenter currentUserId={userId} isAdmin={isAdmin} />
    </div>
  );
}
