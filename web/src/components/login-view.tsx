"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const CONFIGURATION_HINT =
  "伺服器無法簽發登入（常見為缺少 AUTH_SECRET）。本地請檢查 web/.env.local；部署到 Vercel 請在該專案 Settings → Environment Variables 確認已設定 AUTH_SECRET（與 DATABASE_URL），勾選 Production 並重新部署。亦請勿在面板裡把密鑰留了多餘的引號。";

export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** 登入成功後進儀表板（與 middleware 造訪 /login 時行為一致）。 */
  const postLoginPath = "/dashboard";
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = searchParams.get("error");
    if (!q) return;
    const msg =
      q === "Configuration"
        ? CONFIGURATION_HINT
        : q === "CredentialsSignin"
          ? "帳號或密碼不正確。"
          : `登入流程發生問題（錯誤代碼：${q}）`;
    setError(msg);
    router.replace("/login");
  }, [searchParams, router]);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get("email")?.toString() ?? "";
    const password = fd.get("password")?.toString() ?? "";
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: postLoginPath,
    });
    setPending(false);
    if (res?.error) {
      const errType = res.error;
      const errCode = res.code;
      if (errType === "Configuration") {
        setError(CONFIGURATION_HINT);
      } else if (errType === "CredentialsSignin" && errCode === "database_unavailable") {
        setError(
          "無法連線資料庫（請確認 web/.env.local 的 DATABASE_URL、網路與 Neon 狀態；專案請務必從 web 目錄或根目錄 npm run dev 啟動）"
        );
      } else if (errType === "AccessDenied") {
        setError("目前無法登入（權限被拒絕）");
      } else {
        setError(
          "登入失敗：請確認信箱與密碼（若尚未建立帳號請先到「初次設定」，或在 web 目錄執行 npm run db:seed:dev-admin）"
        );
      }
      return;
    }
    router.push(postLoginPath);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">CRM 登入</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">帳號（dev 預設可填 admin）</span>
          <input
            name="email"
            type="text"
            required
            autoComplete="username"
            placeholder="admin 或 admin@example.com"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">密碼</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "登入中…" : "登入"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-zinc-500">
        首次使用？{" "}
        <Link href="/setup" className="text-zinc-900 underline dark:text-zinc-100">
          建立管理員帳號
        </Link>
      </p>
    </div>
  );
}
