import { DocumentsOverview } from "@/components/document-entry/DocumentsOverview";

export default function DocumentDataEntryInventoryPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">庫存信息</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        資料輸入 · 庫存列表；「採購入庫關聯」可展開與本列產品／倉位一致之採購入庫與採購單號。若資料表尚未建立，請執行{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:documents-init</code>。
      </p>
      <DocumentsOverview
        cardTitle="庫存信息"
        cardDescription={
          <>
            檢視庫存筆數與採購入庫關聯。寫入請使用{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/import-documents</code>{" "}
            （類型依匯入流程）。
          </>
        }
        initialTab="inventory"
        tabOrder={["inventory"]}
      />
    </div>
  );
}
