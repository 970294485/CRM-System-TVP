import { DocumentsOverview } from "@/components/document-entry/DocumentsOverview";

export default function DocumentDataEntryQuotationsPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">報價單</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        資料輸入 · 報價單列表。採購單、庫存請自側邊欄「資料輸入」另開。若資料表尚未建立，請執行{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:documents-init</code>。
      </p>
      <DocumentsOverview
        cardTitle="報價單"
        cardDescription={
          <>
            檢視已匯入報價。寫入請使用{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/import-documents</code>{" "}
            （類型 QUOTATION）。
          </>
        }
        initialTab="quotation"
        tabOrder={["quotation"]}
      />
    </div>
  );
}
