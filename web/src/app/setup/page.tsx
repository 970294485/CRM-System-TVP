import { count } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SetupForm } from "@/components/setup-form";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export default async function SetupPage() {
  const db = getDb();
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (Number(total ?? 0) > 0) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-semibold">初次設定</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        建立第一位超級管理員。請先執行資料庫 migration 與 <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">npm run db:seed</code>。
      </p>
      <SetupForm />
      <p className="mt-6 text-center text-sm text-zinc-500">
        已有帳號？{" "}
        <Link href="/login" className="underline">
          返回登入
        </Link>
      </p>
    </div>
  );
}
