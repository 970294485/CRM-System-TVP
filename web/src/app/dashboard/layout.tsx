import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SettingsSidebarNav, type SettingsNavSection } from "@/components/settings/settings-sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { getDb } from "@/db";
import { getEnterpriseSidebarBanner } from "@/lib/enterprise-sidebar";

const settingsSections: SettingsNavSection[] = [
  {
    id: "overview",
    titleZh: "儀表板",
    titleEn: "Dashboard",
    items: [{ href: "/dashboard", label: "總覽" }],
  },
  {
    id: "finance",
    titleZh: "財務管理功能",
    titleEn: "Financial Management Functions",
    items: [
      {
        href: "/dashboard/finance/payment-requests-advances",
        label: "管理請款單與預收款單",
      },
      {
        href: "/dashboard/finance/contract-invoice-advance-matching",
        label: "合同與發票預收款匹配",
      },
      {
        href: "/dashboard/finance/monthly-budget-statistics",
        label: "月度預算統計功能",
      },
      {
        href: "/dashboard/finance/financial-analytics",
        label: "高效財務分析工具",
      },
      {
        href: "/dashboard/finance/budget-control",
        label: "預算收支智能管控",
      },
      {
        href: "/dashboard/finance/multi-level-approval",
        label: "設置多層審批權限",
      },
      { href: "/dashboard/accounting", label: "入賬類別與項目" },
    ],
  },
  {
    id: "account",
    titleZh: "會計管理",
    titleEn: "Account Management",
    items: [
      { href: "/dashboard/account/accounting-categories-settings", label: "入賬類別和項目設定" },
      { href: "/dashboard/account/accounting-basics", label: "會計基礎管理" },
      { href: "/dashboard/account/ar-ap-management", label: "賬款應收/應付管理" },
      { href: "/dashboard/account/income-statement", label: "利潤表" },
      { href: "/dashboard/account/general-ledger", label: "總賬" },
    ],
  },
  {
    id: "sales",
    titleZh: "銷售管理",
    titleEn: "SALES MANAGEMENT",
    items: [
      { href: "/dashboard/sales/quotations", label: "報價單功能" },
      { href: "/dashboard/sales/contracts", label: "銷售合同" },
      { href: "/dashboard/sales/proforma-invoices", label: "預收發票" },
      { href: "/dashboard/sales/analytics-reports", label: "分析報表功能" },
      { href: "/dashboard/sales/stock-purchase-docking", label: "--對應庫單和採購對接功能" },
    ],
  },
  {
    id: "document-export",
    titleZh: "文件導出功能",
    titleEn: "Document Excel & PDF Function",
    items: [],
  },
  {
    id: "file-management",
    titleZh: "文件管理功能",
    titleEn: "File Management Function",
    items: [
      { href: "/dashboard/files/document-classification", label: "文件分類" },
      { href: "/dashboard/files/personal-drive", label: "個人網盤" },
      { href: "/dashboard/files/company-documents", label: "公共文件數據庫" },
    ],
  },
  {
    id: "service-management",
    titleZh: "服務管理功能",
    titleEn: "Service Management Function",
    items: [
      {
        href: "/dashboard/services/customer-service-data-entry-notes",
        label: "客服務數據錄入與備註管理",
      },
      {
        href: "/dashboard/services/purchase-booking-staff-venue",
        label: "購買與預約功能（員工與場地配置）",
      },
      {
        href: "/dashboard/services/order-calendar-sync",
        label: "訂單與負責人行事曆同步",
      },
    ],
  },
  {
    id: "customer-management",
    titleZh: "客戶管理",
    titleEn: "Customer Management Function",
    items: [
      { href: "/dashboard/customers", label: "客戶列表" },
      { href: "/dashboard/sales/customer-analytics", label: "客戶分析圖表" },
      { href: "/dashboard/customers/sales-billing", label: "銷售開單管理" },
      { href: "/dashboard/customers/marketing-email", label: "發送推廣訊息： Email" },
    ],
  },
  {
    id: "data-entry",
    titleZh: "資料輸入",
    titleEn: "PT-Data Entry",
    items: [
      { href: "/dashboard/enterprise", label: "企業基本資料" },
      { href: "/dashboard/doc-master", label: "文件編號及基礎資料管理" },
      { href: "/dashboard/product-entry", label: "產品與服務輸入" },
      { href: "/dashboard/accounting-entry", label: "會計相關錄入" },
      { href: "/dashboard/hr-data", label: "人事數據管理" },
      { href: "/dashboard/document-data-entry/quotations", label: "報價單" },
      { href: "/dashboard/document-data-entry/purchase-orders", label: "採購單" },
      { href: "/dashboard/document-data-entry/inventory", label: "庫存信息" },
    ],
  },
  {
    id: "system",
    titleZh: "系統設置",
    titleEn: "System Setting",
    items: [{ href: "/dashboard/users", label: "用戶與角色" }],
  },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }
  const email = session.user.email;
  const db = getDb();
  const enterpriseBanner = await getEnterpriseSidebarBanner(db);

  return (
    <div className="fixed inset-0 z-0 flex min-h-0 flex-col overflow-hidden overscroll-none bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-screen-2xl gap-8 px-5 py-6 sm:px-6">
        <aside className="flex min-h-0 w-64 shrink-0 flex-col overflow-hidden overscroll-none">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="shrink-0 border-b border-zinc-200 px-3 py-3 text-xs text-zinc-500 dark:border-zinc-700">
              <p className="truncate text-zinc-700 dark:text-zinc-300">{email}</p>
              {enterpriseBanner ? (
                <div className="mt-3 space-y-1 border-t border-dashed border-zinc-200 pt-3 dark:border-zinc-600">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    公司名稱
                  </p>
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {enterpriseBanner.companyName}
                  </p>
                  {enterpriseBanner.metaLine ? (
                    <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">{enterpriseBanner.metaLine}</p>
                  ) : null}
                  {enterpriseBanner.stewardEmailLabel ? (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{enterpriseBanner.stewardEmailLabel}</p>
                  ) : null}
                </div>
              ) : null}
              <div className={`${enterpriseBanner ? "mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700" : "mt-2"}`}>
                <SignOutButton />
              </div>
            </div>
            <SettingsSidebarNav sections={settingsSections} />
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</main>
      </div>
    </div>
  );
}
