import { ResourceBookingWorkspace } from "@/components/service-management/resource-booking-workspace";

export default function PurchaseBookingStaffVenuePage() {
  return (
    <div>
      <h1 className="mb-2 text-xl font-semibold">購買與預約功能（員工與場地配置）</h1>
      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        <strong className="font-medium text-zinc-800 dark:text-zinc-200">功能概要：</strong>
        維護可預約場地／設備主檔，並建立服務預約：可指定負責員工、場地與時段，選填關聯客服案件、加購／耗材說明與預估成本。建立預約時會檢查「同一員工」與「同一場地」的時段是否重疊，避免雙重預約。
        首次使用前請在專案{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">web</code> 目錄依序執行{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:customer-service-init</code>{" "}
        與{" "}
        <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">npm run db:apply:service-resource-booking-init</code>{" "}
        建立資料表。
      </p>
      <ResourceBookingWorkspace />
    </div>
  );
}
