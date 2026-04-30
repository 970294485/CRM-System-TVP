import { auth } from "@/auth";
import { DocumentClassificationManager } from "@/components/files/DocumentClassificationManager";
import { canManageDocuments } from "@/lib/authz";

export default async function DocumentClassificationPage() {
  const session = await auth();
  const editable = canManageDocuments(session);

  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">文件分類</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        依字典維護文件分類，並檢視多態關聯的系統文件列表；上傳可綁定客戶、報價單或採購單（實體儲存可後續串接）。
      </p>
      <DocumentClassificationManager editable={editable} />
    </div>
  );
}
