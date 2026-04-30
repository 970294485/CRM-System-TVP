"use client";

/**
 * Catches errors in the root layout. Must define html/body (replaces root layout when shown).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-zinc-50 antialiased dark:bg-zinc-950">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">系統發生錯誤</h2>
          <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            {process.env.NODE_ENV === "development" ? error.message : "請重新整理頁面或稍後再試。"}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            重試
          </button>
        </div>
      </body>
    </html>
  );
}
