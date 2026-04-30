import { CustomerServiceWorkspace } from "@/components/service-management/customer-service-workspace";

export default function CustomerServiceDataEntryNotesPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">客服務數據錄入與備註管理</h1>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">功能概要：</strong>
        以「案件」為單位匯整客服工單——可連結客戶主檔或手動填寫對象名稱，記錄類型、聯絡管道、狀態與優先級；每一案件支援多筆時間序備註，並保留建立者以利追蹤。
        首次使用前請在專案目錄執行{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:customer-service-init</code>{" "}
        建立資料表。
      </p>
      <CustomerServiceWorkspace />
    </div>
  );
}
