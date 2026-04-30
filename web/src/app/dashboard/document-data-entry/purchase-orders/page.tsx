import { DocumentsOverview } from "@/components/document-entry/DocumentsOverview";

export default function DocumentDataEntryPurchaseOrdersPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">採購單</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        資料輸入 · 採購單列表（供應商為採購對象，非銷售「客戶」模組）；「入庫關聯」可查看本單採購入庫並連至庫存頁；「建立請款」可連至財務模組。若資料表尚未建立，請執行{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:documents-init</code>。
      </p>
      <DocumentsOverview
        cardTitle="採購單"
        cardDescription={
          <>
            檢視已匯入採購單。若明細可解析到產品（<code className="text-xs">product_id</code> 或{" "}
            <code className="text-xs">sku</code>），會寫入 <code className="text-xs">purchase_order_receipts</code> 並累加{" "}
            <code className="text-xs">inventory</code>。寫入請使用{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/import-documents</code>。
          </>
        }
        initialTab="po"
        tabOrder={["po"]}
      />
    </div>
  );
}
