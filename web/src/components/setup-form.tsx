"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name")?.toString() ?? "",
      email: fd.get("email")?.toString() ?? "",
      password: fd.get("password")?.toString() ?? "",
    };
    const res = await fetch("/api/setup/bootstrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "建立失敗");
      setPending(false);
      return;
    }
    const sign = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setPending(false);
    if (sign?.error) {
      setError("帳號已建立，但自動登入失敗，請改由登入頁手動登入。");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <label className="flex flex-col gap-1 text-sm">
        <span>公司 / 您的名稱</span>
        <input
          name="name"
          required
          minLength={1}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Email（登入用）</span>
        <input
          name="email"
          type="email"
          required
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>密碼（至少 8 字元）</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "建立中…" : "建立管理員並登入"}
      </button>
    </form>
  );
}
