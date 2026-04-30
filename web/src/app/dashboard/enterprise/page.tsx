import { asc } from "drizzle-orm";

import { saveOrganization } from "@/actions/admin";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { canEditSettings } from "@/lib/authz";

export default async function EnterpriseProfilePage() {
  const session = await auth();
  const editable = canEditSettings(session);
  const db = getDb();

  const [org] = await db.select().from(organizations).orderBy(asc(organizations.id)).limit(1);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-xl font-semibold">企業基本資料</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        對應單筆公司主檔；側欄顯示之「公司」資訊與綁定帳號由系統自動關聯。
        {!editable ? " 您目前為唯讀權限。" : null}
      </p>

      <form action={saveOrganization} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            公司名稱 *
          </label>
          <input
            id="name"
            name="name"
            required
            defaultValue={org?.name ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        <div>
          <label htmlFor="taxId" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            統一編號
          </label>
          <input
            id="taxId"
            name="taxId"
            defaultValue={org?.taxId ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            電話
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={org?.phone ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            公司聯絡信箱
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={org?.email ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        <div>
          <label htmlFor="address" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            地址
          </label>
          <textarea
            id="address"
            name="address"
            rows={2}
            defaultValue={org?.address ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        <div>
          <label htmlFor="website" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            網站
          </label>
          <input
            id="website"
            name="website"
            type="url"
            defaultValue={org?.website ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="bankName" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              收款銀行
            </label>
            <input
              id="bankName"
              name="bankName"
              defaultValue={org?.bankName ?? ""}
              disabled={!editable}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
            />
          </div>
          <div>
            <label htmlFor="bankAccount" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              銀行帳號
            </label>
            <input
              id="bankAccount"
              name="bankAccount"
              defaultValue={org?.bankAccount ?? ""}
              disabled={!editable}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
            />
          </div>
        </div>
        <div>
          <label htmlFor="notes" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            備註
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={org?.notes ?? ""}
            disabled={!editable}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950 disabled:opacity-70"
          />
        </div>
        {editable ? (
          <div className="pt-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              儲存
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}
