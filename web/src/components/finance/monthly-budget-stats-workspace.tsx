"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MonthRow = {
  month: number;
  label: string;
  confirmedApOutflow: number;
  confirmedArInflow: number;
  netConfirmedCash: number;
};

type ApiPayload = {
  year: number;
  months: MonthRow[];
  payrollBaselineMonthly: number;
  warning?: string;
  notes?: {
    inflow: string;
    outflow: string;
    payroll: string;
  } | null;
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MonthlyBudgetStatsWorkspace() {
  const currentYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<ApiPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (yearStr: string) => {
    setLoading(true);
    setErr(null);
    try {
      const y = Number.parseInt(yearStr, 10);
      if (!Number.isFinite(y)) {
        setErr("請輸入有效年度");
        setData(null);
        return;
      }
      const res = await fetch(`/api/finance/monthly-budget-stats?year=${y}`, { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ApiPayload & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "載入失敗");
      }
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(String(currentYear));
  }, [load, currentYear]);

  const totals = useMemo(() => {
    if (!data?.months?.length) {
      return { in: 0, out: 0, net: 0 };
    }
    return data.months.reduce(
      (acc, m) => ({
        in: acc.in + m.confirmedArInflow,
        out: acc.out + m.confirmedApOutflow,
        net: acc.net + m.netConfirmedCash,
      }),
      { in: 0, out: 0, net: 0 }
    );
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="budget-year" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            統計年度（UTC）
          </label>
          <Input
            id="budget-year"
            className="w-32"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => void load(year)} disabled={loading}>
          {loading ? "載入中…" : "重新計算"}
        </Button>
      </div>

      {err ? (
        <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
      ) : null}
      {data?.warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200">
          {data.warning}
        </p>
      ) : null}

      {data?.payrollBaselineMonthly != null ? (
        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">人事固定成本基準（在職底薪合計）</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {fmtMoney(data.payrollBaselineMonthly)}
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            用於與月度現金統計對照；與表格中「按月已確認請款／預收款」獨立，後者僅包含模組 1 已確認單據。
          </p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80">
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">月份</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-emerald-200">已確認預收款（入）</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-rose-200">已確認應付請款（出）</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">確認口徑淨額</th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-400">與底薪基準差異參考</th>
            </tr>
          </thead>
          <tbody>
            {data?.months.map((row) => {
              const payroll = data.payrollBaselineMonthly ?? 0;
              const burden = row.confirmedApOutflow + payroll;
              const spareVsPayroll =
                payroll > 0 ? row.netConfirmedCash - payroll : row.netConfirmedCash;
              return (
                <tr
                  key={row.month}
                  className="border-b border-zinc-100 odd:bg-white even:bg-zinc-50/80 dark:border-zinc-800 dark:odd:bg-zinc-900/40 dark:even:bg-zinc-900/20"
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                    {row.label}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-emerald-800 dark:text-emerald-300">
                    {fmtMoney(row.confirmedArInflow)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-rose-800 dark:text-rose-300">
                    {fmtMoney(row.confirmedApOutflow)}
                  </td>
                  <td className="px-4 py-2 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                    {fmtMoney(row.netConfirmedCash)}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-zinc-600 dark:text-zinc-400" title={`出+底薪參考合計 ${fmtMoney(burden)}`}>
                    {payroll > 0 ? fmtMoney(spareVsPayroll) : "—"}
                  </td>
                </tr>
              );
            })}
            {data?.months?.length ? (
              <tr className="bg-zinc-100 font-semibold dark:bg-zinc-800/90">
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">本年合計</td>
                <td className="px-4 py-3 tabular-nums text-emerald-900 dark:text-emerald-200">{fmtMoney(totals.in)}</td>
                <td className="px-4 py-3 tabular-nums text-rose-900 dark:text-rose-200">{fmtMoney(totals.out)}</td>
                <td className="px-4 py-3 tabular-nums text-zinc-900 dark:text-zinc-50">{fmtMoney(totals.net)}</td>
                <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">—</td>
              </tr>
            ) : loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  載入中…
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                  無資料
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data?.notes ? (
        <ul className="list-disc space-y-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
          <li>{data.notes.inflow}</li>
          <li>{data.notes.outflow}</li>
          <li>{data.notes.payroll}</li>
        </ul>
      ) : null}
    </div>
  );
}
