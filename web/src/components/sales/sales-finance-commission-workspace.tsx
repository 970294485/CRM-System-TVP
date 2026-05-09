"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type MatchLabel = "none" | "partial" | "target_met" | "contract_paid";

type ContractRow = {
  salesContractId: string;
  contractNo: string;
  customerId: string | null;
  customerName: string;
  contractTotal: string;
  prepaymentAmount: string | null;
  hasPrepayTarget: boolean;
  matchTargetAmount: string;
  proformaInvoiceNo: string | null;
  contractStatus: string;
  contractDate: string;
  advanceReceivedConfirmed: string;
  advanceReceivedDraft: string;
  remainingForPrepayTarget: string | null;
  remainingForContractTotal: string;
  matchLabel: MatchLabel;
  ownerUserId: string | null;
  ownerName: string | null;
  commissionRatePercent: string | null;
  commissionAccruedTotal: string;
};

type AccrualRow = {
  id: string;
  contractNo: string;
  beneficiaryName: string;
  ratePercent: string;
  baseAmount: string;
  commissionAmount: string;
  createdAt: string;
};

const MATCH_LABEL: Record<MatchLabel, string> = {
  none: "尚未預收",
  partial: "部分預收",
  target_met: "預收目標已滿",
  contract_paid: "合同總額已滿",
};

const CONTRACT_STATUS_HK: Record<string, string> = {
  Active: "生效中",
  Completed: "已完成",
  Cancelled: "已取消",
};

function fmtMoney(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  return v.toISOString().slice(0, 10);
}

export function SalesFinanceCommissionWorkspace() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [accruals, setAccruals] = useState<AccrualRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/finance-commission/overview", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as {
        contracts?: ContractRow[];
        recentAccruals?: AccrualRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setContracts([]);
        setAccruals([]);
        toast.error(data.error ?? "載入失敗", { description: data.hint });
        return;
      }
      setContracts(Array.isArray(data.contracts) ? data.contracts : []);
      setAccruals(Array.isArray(data.recentAccruals) ? data.recentAccruals : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">對應財務和佣金功能</h1>
          <p className="text-sm text-zinc-500">
            對應預收款與合同匹配狀態；於銷售合同設定業務負責人與佣金比例後，財務確認預收款時會自動計提佣金（依單筆收款金額 × 比例）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/sales/contracts">銷售合同</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/finance/contract-invoice-advance-matching">合同與預收款匹配</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/finance/payment-requests-advances">預收款單</Link>
          </Button>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">合同 × 預收 × 佣金累計</h2>
        <div className="crm-table-shell overflow-hidden">
          <table className="w-full min-w-[1280px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-4 py-3">合同</th>
                <th className="px-4 py-3">客戶</th>
                <th className="px-4 py-3">合同日</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-4 py-3 text-right">合同總額</th>
                <th className="px-4 py-3 text-right">匹配目標</th>
                <th className="px-4 py-3 text-right">已確認預收</th>
                <th className="px-4 py-3">匹配</th>
                <th className="px-4 py-3">業務</th>
                <th className="px-4 py-3 text-right">佣金%</th>
                <th className="px-4 py-3 text-right">已計提佣金</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">
                    載入中…
                  </td>
                </tr>
              ) : contracts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">
                    尚無合同資料。
                  </td>
                </tr>
              ) : (
                contracts.map((r) => (
                  <tr
                    key={r.salesContractId}
                    className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.contractNo}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.customerName}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                      {ymd(r.contractDate) || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {CONTRACT_STATUS_HK[r.contractStatus] ?? r.contractStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(r.contractTotal)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {fmtMoney(r.matchTargetAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                      {fmtMoney(r.advanceReceivedConfirmed)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {MATCH_LABEL[r.matchLabel] ?? r.matchLabel}
                    </td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{r.ownerName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {r.commissionRatePercent != null && r.commissionRatePercent !== ""
                        ? `${fmtMoney(r.commissionRatePercent)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      {fmtMoney(r.commissionAccruedTotal)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">最近佣金計提（預收款確認寫入）</h2>
        <div className="crm-table-shell overflow-hidden">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-4 py-3">時間</th>
                <th className="px-4 py-3">合同</th>
                <th className="px-4 py-3">受益人</th>
                <th className="px-4 py-3 text-right">比例%</th>
                <th className="px-4 py-3 text-right">計提基礎</th>
                <th className="px-4 py-3 text-right">佣金金額</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    載入中…
                  </td>
                </tr>
              ) : accruals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    尚無計提紀錄。請先在銷售合同設定業務與佣金比例，並由財務確認預收款。
                  </td>
                </tr>
              ) : (
                accruals.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {ymd(a.createdAt) || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{a.contractNo}</td>
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{a.beneficiaryName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(a.ratePercent)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(a.baseAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-700 dark:text-emerald-400">
                      {fmtMoney(a.commissionAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
