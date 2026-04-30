import { OrderCalendarSyncWorkspace } from "@/components/service-management/order-calendar-sync-workspace";

export default function OrderCalendarSyncPage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">訂單與負責人行事曆同步</h1>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">功能概要：</strong>
        彙總服務資源預約與負責人相關的客服案件節點，支援下載 iCalendar（.ics）匯入個人行事曆；事件說明欄含客戶聯絡方式、場地與備註，利於執行端準時到場。若尚未建立預約表，請先完成「購買與預約」模組之資料庫初始化。
      </p>
      <OrderCalendarSyncWorkspace />
    </div>
  );
}
