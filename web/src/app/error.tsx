"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">載入時發生錯誤</h2>
      <p className="max-w-md text-sm text-zinc-600 dark:text-zinc-400">
        {process.env.NODE_ENV === "development" ? error.message : "請稍後再試或重新整理頁面。"}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        重試
      </button>
    </div>
  );
}
