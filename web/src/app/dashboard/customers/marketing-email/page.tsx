import Link from "next/link";
import { asc, eq } from "drizzle-orm";

import { EmailCampaignManager } from "@/components/marketing/email-campaign-manager";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { customerGroups } from "@/db/schema";
import { canEditSales } from "@/lib/authz";

export default async function MarketingEmailPage() {
  const session = await auth();
  const editable = canEditSales(session);
  const db = getDb();

  const groups = await db
    .select({ id: customerGroups.id, name: customerGroups.name })
    .from(customerGroups)
    .where(eq(customerGroups.isActive, true))
    .orderBy(asc(customerGroups.sortOrder), asc(customerGroups.name));

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim()
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-zinc-500">
          <Link href="/dashboard/customers" className="hover:underline">
            客戶列表
          </Link>
          <span className="mx-2">/</span>
        </p>
        <h1 className="mt-1 text-xl font-semibold">發送推廣訊息： Email</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          可依<strong className="font-medium text-zinc-800 dark:text-zinc-200">客戶分組</strong>或
          <strong className="font-medium text-zinc-800 dark:text-zinc-200">手動輸入信箱</strong>
          建立 HTML 郵件、預覽替換變數後再批次發送。可用變數：
          <span className="mx-1 font-medium text-zinc-800 dark:text-zinc-200">客戶名稱</span>
          <span className="text-zinc-400">（{`{{customer_name}}`}）</span>、
          <span className="mx-1 font-medium text-zinc-800 dark:text-zinc-200">聯絡人</span>
          <span className="text-zinc-400">（{`{{contact_name}}`}）</span>、
          <span className="mx-1 font-medium text-zinc-800 dark:text-zinc-200">Email</span>
          <span className="text-zinc-400">（{`{{email}}`}）</span>
          ；編輯器按鈕「插入客戶名稱」會自動寫入對應佔位符。
        </p>
      </div>

      {editable ? (
        <EmailCampaignManager groups={groups} smtpConfigured={smtpConfigured} />
      ) : (
        <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          您的帳號僅能檢視；發送推廣郵件需業務或管理員權限。
        </p>
      )}
    </div>
  );
}
