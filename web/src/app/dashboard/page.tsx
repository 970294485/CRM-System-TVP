import Link from "next/link";

import { auth } from "@/auth";

const cards: { href: string; title: string; desc: string }[] = [
  { href: "/dashboard/enterprise", title: "企業基本資料", desc: "公司抬頭、聯絡方式等主檔" },
  { href: "/dashboard/doc-master", title: "文件編號及基礎資料", desc: "編號規則與 PT 基礎資料" },
  { href: "/dashboard/accounting", title: "入賬類別與項目", desc: "會計科目與項目維護" },
  { href: "/dashboard/customers", title: "客戶管理", desc: "客戶列表與跟進" },
  { href: "/dashboard/users", title: "用戶與角色", desc: "帳號與權限" },
];

export default async function DashboardRootPage() {
  const session = await auth();
  const email = session?.user?.email;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-100">儀表板</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        {email ? `已登入：${email}` : "歡迎使用 CRM"}。請由左側樹狀選單進入各功能，或點選下方捷徑。
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.title}</span>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{c.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
