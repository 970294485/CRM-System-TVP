"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SummaryRow = {
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
  matchLabel: "none" | "partial" | "target_met" | "contract_paid";
};

type ArRow = {
  id: string;
  documentNo: string;
  salesContractId: string;
  amount: string;
  receiptDate: string;
  status: string;
  notes: string | null;
  receivedAt: string | null;
  createdAt: string;
  contractNo: string;
  contractTotal: string;
  customerId: string | null;
  customerName: string;
  proformaInvoiceNo: string | null;
};

type ContractOption = {
  id: string;
  contractNo: string;
  customerName: string;
  customerId: string | null;
  proformaInvoiceNo: string | null;
};

function fmtMoney(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MATCH_LABEL: Record<SummaryRow["matchLabel"], string> = {
  none: "尚未預收",
  partial: "部分預收",
  target_met: "預收目標已滿",
  contract_paid: "合同總額已滿",
};

const AR_STATUS: Record<string, string> = { Draft: "草稿", Received: "已確認收款" };

function contractsForCustomer(ar: ArRow, all: ContractOption[]): ContractOption[] {
  return all.filter((c) =>
    ar.customerId && c.customerId ? c.customerId === ar.customerId : c.customerName.trim() === ar.customerName.trim()
  );
}

export function ContractInvoiceAdvanceMatchingWorkspace({ editable }: { editable: boolean }) {
  const [summary, setSummary] = useState<SummaryRow[]>([]);
  const [arItems, setArItems] = useState<ArRow[]>([]);
  const [contractOptions, setContractOptions] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [assignChoice, setAssignChoice] = useState<Record<string, string>>({});
  const [assignSubmitting, setAssignSubmitting] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/finance/ar-matching/summary", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { items?: SummaryRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "讀取匹配總覽失敗");
    setSummary(data.items ?? []);
  }, []);

  const loadAr = useCallback(async () => {
    const res = await fetch("/api/finance/ar-advance-receipts", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { items?: ArRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "讀取預收款單失敗");
    setArItems(data.items ?? []);
  }, []);

  const loadContracts = useCallback(async () => {
    const res = await fetch("/api/sales/contracts", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { items?: Record<string, unknown>[] };
    if (!res.ok) return;
    if (!Array.isArray(data.items)) return;
    setContractOptions(
      data.items.map((r) => {
        const pfn = r.proformaInvoiceNo ?? r.proforma_invoice_no;
        return {
          id: String(r.id),
          contractNo: String(r.contractNo ?? r.contract_no ?? ""),
          customerName: String(r.customerName ?? r.customer_name ?? ""),
          customerId: (r.customerId ?? r.customer_id ?? null) as string | null,
          proformaInvoiceNo: pfn != null && String(pfn).trim() !== "" ? String(pfn) : null,
        };
      })
    );
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadSummary(), loadAr(), loadContracts()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [loadSummary, loadAr, loadContracts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setAssignChoice((prev) => {
      const next = { ...prev };
      for (const r of arItems) {
        if (next[r.id] === undefined) next[r.id] = r.salesContractId;
      }
      for (const k of Object.keys(next)) {
        if (!arItems.some((r) => r.id === k)) delete next[k];
      }
      return next;
    });
  }, [arItems]);

  const filteredSummary = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return summary;
    return summary.filter(
      (r) =>
        r.contractNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.proformaInvoiceNo?.toLowerCase().includes(q) ?? false)
    );
  }, [summary, filter]);

  const assignContract = async (arId: string) => {
    const salesContractId = assignChoice[arId];
    if (!salesContractId) {
      toast.error("請選擇銷售合同");
      return;
    }
    setAssignSubmitting(arId);
    try {
      const res = await fetch(`/api/finance/ar-advance-receipts/${arId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_contract", salesContractId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "更新失敗");
        return;
      }
      toast.success("已更新預收款掛鉤合同");
      await refresh();
    } finally {
      setAssignSubmitting(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="篩選合同號、客戶、預收發票…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          重新載入
        </Button>
        <Link
          href="/dashboard/finance/payment-requests-advances?tab=ar"
          className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          前往登記預收款單
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">載入中…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">合同／預收發票 · 預收彙總</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              數據來自銷售合同與預收發票（一合同至多一張預收發票）；已確認預收款為「確認收款」後之累計。匹配目標優先採合同上「預收款目標」，未設定時以合同含稅總額為準。
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">合同編號</th>
                    <th className="px-3 py-2 font-medium">客戶</th>
                    <th className="px-3 py-2 font-medium">預收發票</th>
                    <th className="px-3 py-2 text-right font-medium">合同總額</th>
                    <th className="px-3 py-2 text-right font-medium">預收目標</th>
                    <th className="px-3 py-2 text-right font-medium">已確認預收</th>
                    <th className="px-3 py-2 text-right font-medium">草稿預收</th>
                    <th className="px-3 py-2 text-right font-medium">待收（對目標）</th>
                    <th className="px-3 py-2 text-right font-medium">待收（對總額）</th>
                    <th className="px-3 py-2 font-medium">匹配狀態</th>
                    <th className="px-3 py-2 font-medium">合同狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-zinc-500">
                        {summary.length === 0 ? "尚無銷售合同資料。" : "沒有符合篩選的合同。"}
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((r) => (
                      <tr key={r.salesContractId} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 font-mono text-xs">{r.contractNo}</td>
                        <td className="max-w-[160px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                          {r.customerName}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {r.proformaInvoiceNo ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.contractTotal)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.hasPrepayTarget ? fmtMoney(r.prepaymentAmount) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                          {fmtMoney(r.advanceReceivedConfirmed)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-zinc-500">{fmtMoney(r.advanceReceivedDraft)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {r.hasPrepayTarget ? fmtMoney(r.remainingForPrepayTarget) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.remainingForContractTotal)}</td>
                        <td className="px-3 py-2 text-xs">{MATCH_LABEL[r.matchLabel] ?? r.matchLabel}</td>
                        <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400">{r.contractStatus}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">預收款單 · 改掛銷售合同</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              預收款單建立時會先掛鉤一筆銷售合同；若入帳時選錯合同，可於此改掛至同一客戶的其他合同（含草稿與已確認收款）。新掛鉤需通過客戶一致性校驗。
            </p>
            <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <tr>
                    <th className="px-3 py-2 font-medium">預收款單號</th>
                    <th className="px-3 py-2 font-medium">目前合同</th>
                    <th className="px-3 py-2 font-medium">預收發票</th>
                    <th className="px-3 py-2 font-medium">客戶</th>
                    <th className="px-3 py-2 text-right font-medium">金額</th>
                    <th className="px-3 py-2 font-medium">狀態</th>
                    <th className="min-w-[240px] px-3 py-2 font-medium">改掛至合同</th>
                    <th className="px-3 py-2 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {arItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                        尚無預收款單。請至「管理請款單與預收款單」建立並確認收款。
                      </td>
                    </tr>
                  ) : (
                    arItems.map((r) => {
                      const choices = contractsForCustomer(r, contractOptions);
                      const dirty = assignChoice[r.id] !== r.salesContractId;
                      return (
                        <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 font-mono text-xs">{r.documentNo}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.contractNo}</td>
                          <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {r.proformaInvoiceNo ?? "—"}
                          </td>
                          <td className="max-w-[140px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                            {r.customerName}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                          <td className="px-3 py-2">{AR_STATUS[r.status] ?? r.status}</td>
                          <td className="px-3 py-2">
                            <select
                              className="flex h-9 w-full max-w-[280px] rounded-md border border-zinc-200 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                              disabled={!editable || choices.length === 0}
                              value={assignChoice[r.id] ?? r.salesContractId}
                              onChange={(e) =>
                                setAssignChoice((s) => ({
                                  ...s,
                                  [r.id]: e.target.value,
                                }))
                              }
                            >
                              {choices.length === 0 ? (
                                <option value={r.salesContractId}>{r.contractNo}（僅限同客戶合同）</option>
                              ) : (
                                choices.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.contractNo}
                                    {c.proformaInvoiceNo ? ` · ${c.proformaInvoiceNo}` : ""}
                                  </option>
                                ))
                              )}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={!editable || !dirty || assignSubmitting === r.id}
                              onClick={() => void assignContract(r.id)}
                            >
                              {assignSubmitting === r.id ? "更新中…" : "改掛合同"}
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
