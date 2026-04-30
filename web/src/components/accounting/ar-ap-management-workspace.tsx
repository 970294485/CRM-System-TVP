"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import type { AgingBucket, ArApManagementPayload } from "@/lib/finance/ar-ap-snapshot";

type ApiResponse = ArApManagementPayload & { warning?: string; notes?: ArApManagementPayload["notes"] | null };

const BUCKETS: AgingBucket[] = ["0-30", "31-60", "61-90", "90+"];

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

function AgingBars(props: {
  title: string;
  distribution: ArApManagementPayload["agingArDistribution"];
}) {
  const total = useMemo(
    () => BUCKETS.reduce((s, b) => s + props.distribution[b].amountSum, 0),
    [props.distribution]
  );
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{props.title}</h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">按待收／待付本金加總（僅含尚有餘額之明細）</p>
      <div className="mt-4 space-y-3">
        {BUCKETS.map((b) => {
          const { lineCount, amountSum } = props.distribution[b];
          const pct = total > 0 ? Math.round((amountSum / total) * 1000) / 10 : 0;
          return (
            <div key={b}>
              <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                <span>
                  {b} 天{b === "90+" ? "以上" : ""}
                  <span className="ml-2 text-zinc-400">（{lineCount} 筆）</span>
                </span>
                <span className="tabular-nums text-zinc-800 dark:text-zinc-200">{fmtMoney(amountSum)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-700 dark:bg-zinc-300"
                  style={{ width: `${total > 0 ? Math.min(100, (amountSum / total) * 100) : 0}%` }}
                />
              </div>
              <p className="mt-0.5 text-right text-[10px] text-zinc-400">{pct}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ArApManagementWorkspace() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/account/ar-ap-management", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as ApiResponse & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "載入失敗");
      setData(json);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "載入失敗");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return <p className="text-sm text-zinc-500">載入應收應付…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
          {loading ? "更新中…" : "重新整理"}
        </Button>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/finance/contract-invoice-advance-matching">
            合同／預收匹配
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/finance/payment-requests-advances">
            請款與預收款
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/sales/contracts">
            銷售合同
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/document-data-entry/purchase-orders">
            採購單
          </Link>
        </div>
      </div>

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {data?.warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200">
          {data.warning}
        </p>
      ) : null}

      {data && data.notes ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">應收（合同／預收）</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="合同待收餘額"
                value={fmtMoney(data.receivables.outstandingContractTotalSum)}
                subtitle={`${data.receivables.contractsWithReceivableBalance} 份合同仍有餘額`}
                tone="in"
              />
              <StatCard
                title="預收目標待滿足"
                value={fmtMoney(data.receivables.prepaymentTargetRemainingSum)}
                subtitle="有設定預收金額之合同"
                tone="neutral"
              />
              <StatCard
                title="已確認預收款"
                value={fmtMoney(data.receivables.confirmedAdvanceReceiptsTotal)}
                subtitle="預收款單 Received"
                tone="neutral"
              />
              <StatCard
                title="草稿預收款"
                value={fmtMoney(data.receivables.draftAdvanceReceiptsTotal)}
                subtitle="尚未確認"
                tone="neutral"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">應付（採購）</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="採購單待付餘額"
                value={fmtMoney(data.payables.outstandingPurchaseOrderBalanceSum)}
                subtitle={`${data.payables.purchaseOrdersWithBalanceCount} 筆仍有未付`}
                tone="out"
              />
              <StatCard
                title="草稿應付請款"
                value={fmtMoney(data.payables.draftApPaymentRequestsSum)}
                subtitle="尚未確認付款"
                tone="neutral"
              />
              <StatCard
                title="淨頭寸（粗估）"
                value={fmtMoney(data.cashFlowLens.netPositionHint)}
                subtitle="待收 − 待付"
                tone="accent"
              />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <AgingBars title="應收帳齡分布（按合同日）" distribution={data.agingArDistribution} />
            <AgingBars title="應付帳齡分布（按採購日）" distribution={data.agingApDistribution} />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="crm-table-shell overflow-x-auto">
              <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                應收明細（合同）
              </div>
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/50">
                    <th className="px-3 py-2 font-medium">合同號</th>
                    <th className="px-3 py-2 font-medium">客戶</th>
                    <th className="px-3 py-2 font-medium">合同日</th>
                    <th className="px-3 py-2 text-right font-medium">待收</th>
                    <th className="px-3 py-2 text-right font-medium">預收差</th>
                    <th className="px-3 py-2 text-right font-medium">帳齡(天)</th>
                    <th className="px-3 py-2 font-medium">桶</th>
                    <th className="px-3 py-2 font-medium">預收發票</th>
                  </tr>
                </thead>
                <tbody>
                  {data.arLines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                        無待收或預收目標差異之合同
                      </td>
                    </tr>
                  ) : (
                    data.arLines.map((r) => (
                      <tr
                        key={r.contractId}
                        className="border-b border-zinc-100 dark:border-zinc-800/80 odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-900/20 dark:even:bg-zinc-900/10"
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.contractNo}</td>
                        <td className="max-w-[160px] truncate px-3 py-2">{r.customerName}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.contractDate}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.remainingTotal)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">
                          {r.prepayRemaining != null ? fmtMoney(r.prepayRemaining) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.daysSinceContract}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{r.agingBucket}</td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-500">
                          {r.proformaInvoiceNo ?? "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="crm-table-shell overflow-x-auto">
              <div className="border-b border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                應付明細（採購單）
              </div>
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-left dark:border-zinc-700 dark:bg-zinc-800/50">
                    <th className="px-3 py-2 font-medium">採購單號</th>
                    <th className="px-3 py-2 font-medium">供應商</th>
                    <th className="px-3 py-2 font-medium">採購日</th>
                    <th className="px-3 py-2 text-right font-medium">未付</th>
                    <th className="px-3 py-2 text-right font-medium">帳齡(天)</th>
                    <th className="px-3 py-2 font-medium">桶</th>
                    <th className="px-3 py-2 font-medium">付款狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {data.apLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                        無未付採購單
                      </td>
                    </tr>
                  ) : (
                    data.apLines.map((r) => (
                      <tr
                        key={r.purchaseOrderId}
                        className="border-b border-zinc-100 dark:border-zinc-800/80 odd:bg-white even:bg-zinc-50/50 dark:odd:bg-zinc-900/20 dark:even:bg-zinc-900/10"
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">{r.poNo}</td>
                        <td className="max-w-[160px] truncate px-3 py-2">{r.supplierName ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-400">{r.poDate}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.unpaidBalance)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.daysSincePo}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-600">{r.agingBucket}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{r.paymentStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="list-disc space-y-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
            <li>{data.notes.receivable}</li>
            <li>{data.notes.payable}</li>
            <li>{data.notes.cashFlow}</li>
            <li>{data.notes.aging}</li>
          </ul>
        </>
      ) : null}
    </div>
  );
}
