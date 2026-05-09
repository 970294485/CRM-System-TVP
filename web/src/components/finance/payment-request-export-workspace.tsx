"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  PaymentRequestPrintView,
  type PaymentRequestPrintViewProps,
} from "@/components/finance/payment-request-print-view";
import type { QuotationPrintOrg } from "@/components/sales/quotation-print-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ApRow = {
  id: string;
  documentNo: string;
  purchaseOrderId: string;
  amount: string;
  requestDate: string;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  poNo: string;
  poTotal: string;
  poPaid: string;
  poPaymentStatus: string;
  supplierName: string | null;
};

const AP_STATUS: Record<string, string> = { Draft: "草稿", Confirmed: "已確認付款" };
const PO_PAY: Record<string, string> = { Unpaid: "未付", Partial: "部分付款", Paid: "已付清" };

function fmtMoney(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowToPrintProps(row: ApRow): Omit<PaymentRequestPrintViewProps, "org" | "bankName" | "bankAccount"> {
  const rd = row.requestDate.length >= 10 ? row.requestDate.slice(0, 10) : row.requestDate;
  return {
    documentNo: row.documentNo,
    requestDate: rd,
    statusLabel: AP_STATUS[row.status] ?? row.status,
    supplierName: row.supplierName,
    poNo: row.poNo,
    poTotal: row.poTotal,
    poPaid: row.poPaid,
    poPaymentStatusLabel: PO_PAY[row.poPaymentStatus] ?? row.poPaymentStatus,
    amount: row.amount,
    notes: row.notes,
  };
}

type Props = {
  org: QuotationPrintOrg;
  bankName: string | null;
  bankAccount: string | null;
};

export function PaymentRequestExportWorkspace({ org, bankName, bankAccount }: Props) {
  const [rows, setRows] = useState<ApRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listWarning, setListWarning] = useState<string | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<Omit<PaymentRequestPrintViewProps, "org" | "bankName" | "bankAccount"> | null>(
    null
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setListWarning(null);
    try {
      const res = await fetch("/api/finance/ap-payment-requests", { credentials: "same-origin" });
      const data = (await res.json()) as {
        items?: ApRow[];
        error?: string;
        warning?: string;
        hint?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "無法讀取請款單");
        if (data.hint) toast.message(data.hint);
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.items) ? data.items : []);
      if (data.warning) setListWarning(data.warning);
    } catch {
      toast.error("無法載入請款單");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openExport = (r: ApRow) => {
    setPrintSnapshot(rowToPrintProps(r));
    setPrintOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">導出 PAYMENT REQUEST</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          應付請款單（掛採購單）之預覽與 PDF；資料來自「財務 › 管理請款單與預收款單」同一來源。開立與確認請款請至該頁。
        </p>
        <p className="text-sm">
          <Link
            href="/dashboard/finance/payment-requests-advances?tab=ap"
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            前往管理請款單與預收款單（AP）
          </Link>
          <span className="text-zinc-500"> · </span>
          <Link
            href="/dashboard/doc-master?tab=numbering"
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            文件編號
          </Link>
        </p>
      </header>

      {listWarning ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100"
        >
          {listWarning}
        </div>
      ) : null}

      <div className="crm-table-shell overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">請款單號</th>
              <th className="px-4 py-3">請款日</th>
              <th className="px-4 py-3">供應商</th>
              <th className="px-4 py-3">採購單號</th>
              <th className="px-4 py-3 text-right">本次請款</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  載入中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                  尚無應付請款單。請至財務頁開立後再回到此頁導出。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">{r.documentNo}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">
                    {r.requestDate.length >= 10 ? r.requestDate.slice(0, 10) : r.requestDate}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.supplierName ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{r.poNo}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                    {fmtMoney(r.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {AP_STATUS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => openExport(r)}>
                      導出 PDF
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <DialogContent className="max-h-[min(92vh,900px)] w-[min(96vw,56rem)] max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>導出 PAYMENT REQUEST</DialogTitle>
            <DialogDescription>以下為 A4 預覽；點「下載 PDF」開啟列印並選擇「另存為 PDF」。</DialogDescription>
          </DialogHeader>
          {printSnapshot ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <PaymentRequestPrintView
                org={org}
                bankName={bankName}
                bankAccount={bankAccount}
                {...printSnapshot}
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPrintOpen(false)}>
              關閉
            </Button>
            <Button type="button" onClick={() => window.print()}>
              下載 PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
