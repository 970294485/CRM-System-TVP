import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { FollowUpActivityForm } from "@/components/customers/follow-up-activity-form";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { customerFollowUpActivities, customers, users } from "@/db/schema";
import { canEditSales } from "@/lib/authz";

const CHANNEL_LABEL: Record<string, string> = {
  phone: "電話",
  visit: "拜訪",
  meeting: "會議",
  email: "郵件",
  other: "其他",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) notFound();

  const session = await auth();
  const editable = canEditSales(session);
  const db = getDb();

  const [row] = await db.select().from(customers).where(eq(customers.id, idParsed.data)).limit(1);
  if (!row) notFound();

  const activities = await db
    .select({
      id: customerFollowUpActivities.id,
      occurredAt: customerFollowUpActivities.occurredAt,
      channel: customerFollowUpActivities.channel,
      summary: customerFollowUpActivities.summary,
      nextFollowUpAt: customerFollowUpActivities.nextFollowUpAt,
      createdAt: customerFollowUpActivities.createdAt,
      authorName: users.name,
    })
    .from(customerFollowUpActivities)
    .leftJoin(users, eq(customerFollowUpActivities.createdByUserId, users.id))
    .where(eq(customerFollowUpActivities.customerId, idParsed.data))
    .orderBy(desc(customerFollowUpActivities.occurredAt));

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">
            <Link href="/dashboard/customers" className="hover:underline">
              客戶列表
            </Link>
            <span className="mx-2">/</span>
          </p>
          <h1 className="mt-1 text-xl font-semibold">{row.name}</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            客戶主檔的新增、檢視、編輯與刪除請在{" "}
            <Link href="/dashboard/customers" className="font-medium text-blue-700 underline dark:text-blue-400">
              客戶列表
            </Link>{" "}
            以表格與彈窗操作。
          </p>
        </div>
        <div className="max-w-md space-y-2 text-xs text-zinc-500">
          <p>
            <span className="font-medium text-zinc-600 dark:text-zinc-400">銷售開單：</span>
            由此前往{" "}
            <Link
              href={`/dashboard/customers/sales-billing?customerId=${row.id}`}
              className="font-medium text-blue-700 underline dark:text-blue-400"
            >
              銷售開單管理
            </Link>
            （報價總覽）或{" "}
            <Link
              href="/dashboard/document-data-entry/quotations"
              className="font-medium text-blue-700 underline dark:text-blue-400"
            >
              報價資料輸入
            </Link>
            ；合同與預收發票將與模組 3 對接。
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">跟進紀錄</h2>
        <FollowUpActivityForm customerId={row.id} editable={editable} />

        <div className="crm-table-shell">
          <table className="w-full min-w-[960px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <th className="px-4 py-3 font-medium">時間</th>
                <th className="px-4 py-3 font-medium">方式</th>
                <th className="px-4 py-3 font-medium">紀錄者</th>
                <th className="px-4 py-3 font-medium">摘要</th>
                <th className="px-4 py-3 font-medium">下次跟進</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    尚無跟進紀錄。
                  </td>
                </tr>
              ) : (
                activities.map((a) => (
                  <tr key={a.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-600 dark:text-zinc-400">
                      {new Date(a.occurredAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-top">{CHANNEL_LABEL[a.channel] ?? a.channel}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-zinc-600 dark:text-zinc-400">
                      {a.authorName ?? "—"}
                    </td>
                    <td className="max-w-md px-4 py-3 align-top whitespace-pre-wrap">{a.summary}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top text-xs text-zinc-600 dark:text-zinc-400">
                      {a.nextFollowUpAt
                        ? new Date(a.nextFollowUpAt).toLocaleString(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
