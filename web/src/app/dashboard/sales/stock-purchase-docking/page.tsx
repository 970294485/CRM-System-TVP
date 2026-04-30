import Link from "next/link";

import { DocumentsOverview } from "@/components/document-entry/DocumentsOverview";

export default function StockPurchaseDockingPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">對應庫單和採購對接功能</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          預設開啟「採購單」，可切換「庫存信息」核對採購入庫與庫存連結；必要時切換「報價單」對照銷售端。採購表之供應商欄位僅表示採購對象，與銷售「客戶」模組無業務上必然對應。採購單列可點「建立請款」前往財務頁並帶入該採購單。下方表格與「資料輸入」區同源，無需重複匯入。
        </p>
        <p className="text-sm">
          <Link
            href="/dashboard/document-data-entry/purchase-orders"
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            資料輸入區（匯入說明與完整分頁標題）
          </Link>
        </p>
      </header>

      <DocumentsOverview
        initialTab="po"
        tabOrder={["po", "inventory", "quotation"]}
        cardTitle="採購 · 庫存 · 報價對照"
        cardDescription={
          <>
            採購列「入庫筆數」對應 <code className="text-xs">purchase_order_receipts</code>；庫存列「採購入庫筆數」為與採購入庫之關聯計數。寫入請使用{" "}
            <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/import-documents</code>。
          </>
        }
      />
    </div>
  );
}
