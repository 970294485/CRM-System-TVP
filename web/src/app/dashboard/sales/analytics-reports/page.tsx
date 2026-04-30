import { CustomerAnalyticsDashboard } from "@/components/analytics/customer-analytics-dashboard";

export default function SalesAnalyticsReportsPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">分析報表功能</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        銷售相關數據彙總與圖表：客戶增長、產業分佈與報價貢獻等。若產業圖表無資料，請先執行{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:customer-analytics</code>{" "}
        擴充欄位並於客戶主檔填寫產業別。
      </p>
      <CustomerAnalyticsDashboard />
    </div>
  );
}
