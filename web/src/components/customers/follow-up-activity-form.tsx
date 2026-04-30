"use client";

import { useEffect, useState } from "react";

import { saveFollowUpActivity } from "@/actions/customers";

const CHANNEL_OPTS: { value: string; label: string }[] = [
  { value: "phone", label: "電話" },
  { value: "visit", label: "拜訪" },
  { value: "meeting", label: "會議" },
  { value: "email", label: "郵件" },
  { value: "other", label: "其他" },
];

export function FollowUpActivityForm({ customerId, editable }: { customerId: string; editable: boolean }) {
  const [occurred, setOccurred] = useState("");

  useEffect(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setOccurred(local);
  }, []);

  if (!editable) {
    return null;
  }

  return (
    <form action={saveFollowUpActivity} className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/80">
      <input type="hidden" name="customerId" value={customerId} />
      <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">新增跟進紀錄</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">方式</span>
          <select
            name="channel"
            required
            defaultValue="phone"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          >
            {CHANNEL_OPTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">發生時間</span>
          <input
            name="occurredAt"
            type="datetime-local"
            required
            value={occurred}
            onChange={(e) => setOccurred(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">摘要 *</span>
          <textarea
            name="summary"
            required
            rows={3}
            placeholder="溝通內容、待辦、報價進度等"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-zinc-600 dark:text-zinc-400">下次跟進時間（可選）</span>
          <input
            name="nextFollowUpAt"
            type="datetime-local"
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950"
          />
        </label>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        新增紀錄
      </button>
    </form>
  );
}
