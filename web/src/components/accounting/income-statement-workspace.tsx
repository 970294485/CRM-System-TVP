"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import type { IncomeStatementPayload } from "@/lib/finance/income-statement-snapshot";

type ApiResponse = IncomeStatementPayload & { warning?: string; notes?: IncomeStatementPayload["notes"] | null };

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatCard(props: {
  title: string;
  value: string;
  subtitle?: string;
  tone?: "neutral" | "in" | "out" | "accent";
}) {
  const tone =
    props.tone === "in"
      ? "border-emerald-200 bg-emerald-50/90 dark:border-emerald-900/60 dark:bg-emerald-950/30"
      : props.tone === "out"
        ? "border-rose-200 bg-rose-50/90 dark:border-rose-900/60 dark:bg-rose-950/30"
        : props.tone === "accent"
          ? "border-violet-200 bg-violet-50/90 dark:border-violet-900/60 dark:bg-violet-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60";
  return (
    <div className={`rounded-lg border px-4 py-3 shadow-sm ${tone}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{props.title}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{props.value}</p>
      {props.subtitle ? (
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{props.subtitle}</p>
      ) : null}
    </div>
  );
}

export function IncomeStatementWorkspace(props: {
  initialYear: number;
  /** inclusive */
  minYear?: number;
  maxYear?: number;
}) {
  const minY = props.minYear ?? 2000;
  const maxY = props.maxYear ?? 2100;
  const [year, setYear] = useState(props.initialYear);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = maxY; y >= minY; y--) list.push(y);
    return list;
  }, [minY, maxY]);

  const load = useCallback(async (y: number) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/account/income-statement?year=${y}`, { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ApiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
      setYear(json.year);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(props.initialYear);
  }, [load, props.initialYear]);

  const currencyLabel = data?.baseCurrencyIso ?? "";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">會計年度</span>
          <select
            value={year}
            disabled={loading}
            onChange={(e) => {
              const y = Number(e.target.value);
              if (!Number.isFinite(y)) return;
              void load(y);
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" onClick={() => void load(year)} disabled={loading}>
          {loading ? "更新中…" : "重新整理"}
        </Button>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/sales/contracts">
            銷售合同
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/document-data-entry/purchase-orders">
            採購單
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/hr-data">
            人事數據
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/finance/monthly-budget-statistics">
            月度預算統計（現金確認口徑）
          </Link>
        </div>
      </div>

      {currencyLabel ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          金額單位：{currencyLabel}（與會計基礎本位幣一致）。
        </p>
      ) : null}

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {data?.warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200">
          {data.warning}
        </p>
      ) : null}

      {data && data.notes ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">年度彙總（簡式）</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="營業收入" value={fmtMoney(data.annual.revenue)} subtitle={`合同 ${data.annual.contractCount} 筆`} tone="in" />
              <StatCard
                title="採購成本（進貨）"
                value={fmtMoney(data.annual.procurementCost)}
                subtitle={`採購單 ${data.annual.purchaseOrderCount} 筆`}
                tone="out"
              />
              <StatCard
                title="人事費用（估算）"
                value={fmtMoney(data.annual.payrollExpense)}
                subtitle={`月估算 ${fmtMoney(data.payrollMonthlyEstimate)} ×12`}
                tone="neutral"
              />
              <StatCard title="毛利" value={fmtMoney(data.annual.grossProfit)} subtitle="收入 − 採購" tone="accent" />
              <StatCard title="營業利益（估算）" value={fmtMoney(data.annual.operatingProfit)} subtitle="毛利 − 人事" tone="accent" />
            </div>
          </section>

          <section className="crm-table-shell overflow-x-auto">
            <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              月度損益（{data.year}）
            </div>
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-3 py-2 font-medium">期間</th>
                  <th className="px-3 py-2 text-right font-medium">營業收入</th>
                  <th className="px-3 py-2 text-right font-medium">採購成本</th>
                  <th className="px-3 py-2 text-right font-medium">人事費用</th>
                  <th className="px-3 py-2 text-right font-medium">毛利</th>
                  <th className="px-3 py-2 text-right font-medium">營業利益</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">合同數</th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500">採購數</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((r) => (
                  <tr
                    key={r.month}
                    className="border-b border-zinc-100 dark:border-zinc-800/80 odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-900/20 dark:even:bg-zinc-900/10"
                  >
                    <td className="whitespace-nowrap px-3 py-2">{r.label}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.revenue)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.procurementCost)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.payrollExpense)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.grossProfit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(r.operatingProfit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">{r.contractCount}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">{r.purchaseOrderCount}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-zinc-300 bg-zinc-100/80 font-semibold dark:border-zinc-600 dark:bg-zinc-800/60">
                  <td className="px-3 py-2">本年合計</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.annual.revenue)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.annual.procurementCost)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.annual.payrollExpense)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.annual.grossProfit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(data.annual.operatingProfit)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-600">{data.annual.contractCount}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-600">{data.annual.purchaseOrderCount}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="crm-table-shell overflow-x-auto">
            <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              季度彙總
            </div>
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="px-3 py-2 font-medium">季度</th>
                  <th className="px-3 py-2 text-right font-medium">營業收入</th>
                  <th className="px-3 py-2 text-right font-medium">採購成本</th>
                  <th className="px-3 py-2 text-right font-medium">人事費用</th>
                  <th className="px-3 py-2 text-right font-medium">毛利</th>
                  <th className="px-3 py-2 text-right font-medium">營業利益</th>
                </tr>
              </thead>
              <tbody>
                {data.quarters.map((r) => (
                  <tr
                    key={r.quarter}
                    className="border-b border-zinc-100 dark:border-zinc-800/80 odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-900/20 dark:even:bg-zinc-900/10"
                  >
                    <td className="whitespace-nowrap px-3 py-2">{r.label}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.revenue)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.procurementCost)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.payrollExpense)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.grossProfit)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(r.operatingProfit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <ul className="list-disc space-y-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
            <li>{data.notes.revenue}</li>
            <li>{data.notes.procurement}</li>
            <li>{data.notes.payroll}</li>
            <li>{data.notes.interpretation}</li>
          </ul>
        </>
      ) : null}
    </div>
  );
}
