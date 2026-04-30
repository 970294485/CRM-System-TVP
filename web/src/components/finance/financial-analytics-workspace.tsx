"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type Overview = {
  receivables: {
    outstandingContractTotalSum: number;
    contractsWithReceivableBalance: number;
    prepaymentTargetRemainingSum: number;
    confirmedAdvanceReceiptsTotal: number;
    draftAdvanceReceiptsTotal: number;
  };
  payables: {
    outstandingPurchaseOrderBalanceSum: number;
    purchaseOrdersWithBalanceCount: number;
    draftApPaymentRequestsSum: number;
  };
  cashFlowLens: {
    projectedReceivableFromContracts: number;
    projectedOutflowFromPurchaseOrders: number;
    netPositionHint: number;
  };
  topContractsByRemaining: {
    contractNo: string;
    customerName: string;
    remainingTotal: number;
    prepayRemaining: number | null;
    contractDate: string;
  }[];
  topPurchaseOrdersByUnpaid: {
    poNo: string;
    supplierName: string | null;
    unpaidBalance: number;
    paymentStatus: string;
    poDate: string;
  }[];
  warning?: string;
  notes?: {
    receivable: string;
    payable: string;
    cashFlow: string;
  } | null;
};

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

export function FinancialAnalyticsWorkspace() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/finance/analytics-overview", { credentials: "same-origin" });
      const json = (await res.json().catch(() => ({}))) as Overview & { error?: string };
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
    return <p className="text-sm text-zinc-500">載入分析數據…</p>;
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
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/document-data-entry/purchase-orders">
            採購單（資料輸入）
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/finance/payment-requests-advances">
            請款與預收款
          </Link>
          <Link className="underline hover:text-zinc-800 dark:hover:text-zinc-200" href="/dashboard/finance/monthly-budget-statistics">
            月度預算統計
          </Link>
        </div>
      </div>

      {err ? <p className="text-sm text-red-600 dark:text-red-400">{err}</p> : null}
      {data?.warning ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/80 dark:bg-amber-950/40 dark:text-amber-200">
          {data.warning}
        </p>
      ) : null}

      {data ? (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">應收／預收（合同維度）</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="合同待收餘額（總額口徑）"
                value={fmtMoney(data.receivables.outstandingContractTotalSum)}
                subtitle={`${data.receivables.contractsWithReceivableBalance} 份合同仍有餘額`}
                tone="in"
              />
              <StatCard
                title="預收目標待滿足餘額"
                value={fmtMoney(data.receivables.prepaymentTargetRemainingSum)}
                subtitle="有設定 prepayment 之合同"
                tone="neutral"
              />
              <StatCard
                title="已登記預收款（已確認）"
                value={fmtMoney(data.receivables.confirmedAdvanceReceiptsTotal)}
                subtitle="模組 1 預收款單 Received"
                tone="neutral"
              />
              <StatCard
                title="草稿預收款"
                value={fmtMoney(data.receivables.draftAdvanceReceiptsTotal)}
                subtitle="尚未確認入帳"
                tone="neutral"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">應付（採購／請款）</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                title="採購單待付款餘額"
                value={fmtMoney(data.payables.outstandingPurchaseOrderBalanceSum)}
                subtitle={`${data.payables.purchaseOrdersWithBalanceCount} 筆採購仍有未付餘額`}
                tone="out"
              />
              <StatCard
                title="草稿應付請款單"
                value={fmtMoney(data.payables.draftApPaymentRequestsSum)}
                subtitle="尚未確認付款"
                tone="neutral"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">現金流透視（粗估）</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard
                title="合同端待收"
                value={fmtMoney(data.cashFlowLens.projectedReceivableFromContracts)}
                tone="in"
              />
              <StatCard
                title="採購端待付"
                value={fmtMoney(data.cashFlowLens.projectedOutflowFromPurchaseOrders)}
                tone="out"
              />
              <StatCard
                title="淨頭寸（待收 − 待付）"
                value={fmtMoney(data.cashFlowLens.netPositionHint)}
                subtitle="營運資金壓力參考，非會計報表"
                tone="accent"
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                合同待收 Top 10
              </div>
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-3 py-2">合同號</th>
                    <th className="px-3 py-2">客戶</th>
                    <th className="px-3 py-2 text-right">待收</th>
                    <th className="px-3 py-2 text-right">預收目標差</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topContractsByRemaining.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                        無待收合同
                      </td>
                    </tr>
                  ) : (
                    data.topContractsByRemaining.map((r) => (
                      <tr
                        key={r.contractNo}
                        className="border-b border-zinc-50 odd:bg-white even:bg-zinc-50/50 dark:border-zinc-800/80 dark:odd:bg-zinc-900/30 dark:even:bg-zinc-900/10"
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{r.contractNo}</td>
                        <td className="max-w-[140px] truncate px-3 py-2">{r.customerName}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.remainingTotal)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-zinc-500">
                          {r.prepayRemaining != null ? fmtMoney(r.prepayRemaining) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="border-b border-zinc-100 px-4 py-2 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                採購未付 Top 10
              </div>
              <table className="w-full min-w-[320px] text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
                    <th className="px-3 py-2">採購單號</th>
                    <th className="px-3 py-2">供應商</th>
                    <th className="px-3 py-2 text-right">未付</th>
                    <th className="px-3 py-2">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topPurchaseOrdersByUnpaid.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                        無未付採購
                      </td>
                    </tr>
                  ) : (
                    data.topPurchaseOrdersByUnpaid.map((r) => (
                      <tr
                        key={r.poNo}
                        className="border-b border-zinc-50 odd:bg-white even:bg-zinc-50/50 dark:border-zinc-800/80 dark:odd:bg-zinc-900/30 dark:even:bg-zinc-900/10"
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">{r.poNo}</td>
                        <td className="max-w-[140px] truncate px-3 py-2">{r.supplierName ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmtMoney(r.unpaidBalance)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-500">{r.paymentStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {data.notes ? (
            <ul className="list-disc space-y-2 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
              <li>{data.notes.receivable}</li>
              <li>{data.notes.payable}</li>
              <li>{data.notes.cashFlow}</li>
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
