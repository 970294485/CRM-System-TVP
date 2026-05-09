"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ProformaInvoicePrintView,
  type ProformaInvoicePrintViewProps,
} from "@/components/sales/proforma-invoice-print-view";
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
import { lineTotalFromInputs, totalsFromLines } from "@/lib/sales/quotation-math";

type Row = {
  id: string;
  invoiceNo: string;
  contractId: string;
  sourceContractNo: string;
  customerName: string;
  issueDate: string;
  totalAmount: string;
  status: string;
  createdAt: string;
};

function ymd(v: string | Date | null | undefined): string {
  if (!v) return "—";
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  return v.toISOString().slice(0, 10);
}

function fmtMoney(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_HK: Record<string, string> = {
  Issued: "已開立",
  Cancelled: "已作廢",
};

type ProformaDetail = {
  id: string;
  invoiceNo: string;
  contractId: string;
  sourceContractNo: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  issueDate: string;
  items: unknown;
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  status: string;
  notes: string | null;
  createdAt: string;
  customerCode: string | null;
  contactName: string | null;
  customerAddress: string | null;
};

function normalizeItemFromApi(raw: unknown): {
  name: string;
  sku: string;
  qty: number;
  unit_price: number;
  discount: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return null;
  const qty = Number(o.qty);
  const unit =
    o.unit_price != null && Number.isFinite(Number(o.unit_price))
      ? Number(o.unit_price)
      : o.price != null && Number.isFinite(Number(o.price))
        ? Number(o.price)
        : 0;
  const discount = o.discount != null && Number.isFinite(Number(o.discount)) ? Number(o.discount) : 0;
  const sku = o.sku != null ? String(o.sku) : "";
  return {
    name,
    sku,
    qty: Number.isFinite(qty) ? qty : 0,
    unit_price: unit,
    discount,
  };
}

function buildProformaPrintSnapshot(row: ProformaDetail): Omit<ProformaInvoicePrintViewProps, "org"> {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems.map(normalizeItemFromApi).filter((x): x is NonNullable<typeof x> => x != null);
  const lines = items.map((l) => ({
    name: l.name,
    sku: l.sku?.trim() ? l.sku : null,
    qty: l.qty,
    unit_price: l.unit_price,
    discount: l.discount ?? 0,
    line_total: lineTotalFromInputs(l.qty, l.unit_price, l.discount ?? 0),
  }));
  const taxRate = row.taxRate != null && row.taxRate !== "" ? Number(row.taxRate) : 5;
  const subN = row.subtotal != null && row.subtotal !== "" ? Number(row.subtotal) : NaN;
  const taxN = row.taxAmount != null && row.taxAmount !== "" ? Number(row.taxAmount) : NaN;
  const totN = Number(row.totalAmount);
  const useStored = Number.isFinite(subN) && Number.isFinite(taxN) && Number.isFinite(totN);
  const { subtotal, tax_amount, total_amount } = useStored
    ? { subtotal: subN, tax_amount: taxN, total_amount: totN }
    : totalsFromLines(
        lines.map((l) => l.line_total),
        taxRate
      );

  const issue = ymd(row.issueDate);
  return {
    invoiceNo: row.invoiceNo,
    issueDate: issue === "—" ? "" : issue,
    sourceContractNo: row.sourceContractNo,
    statusLabel: STATUS_HK[row.status] ?? row.status,
    customerName: row.customerName,
    customerCode: row.customerCode,
    contactName: row.contactName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerAddress: row.customerAddress,
    lines,
    subtotal,
    taxRate: Number.isFinite(taxRate) ? taxRate : 5,
    taxAmount: tax_amount,
    totalAmount: total_amount,
    notes: row.notes,
  };
}

type WorkspaceProps = {
  org: QuotationPrintOrg;
  /** 未傳則為銷售頁預設「預收發票」 */
  headingTitle?: string;
  headingDescription?: string;
};

export function ProformaInvoicesWorkspace({
  org,
  headingTitle,
  headingDescription,
}: WorkspaceProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<Omit<ProformaInvoicePrintViewProps, "org"> | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/proforma-invoices", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: Row[] };
      if (!res.ok) {
        setRows([]);
        return;
      }
      setRows(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openDownloadForRow = async (r: Row) => {
    try {
      const res = await fetch(`/api/sales/proforma-invoices/${r.id}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { item?: ProformaDetail; error?: string };
      if (!res.ok || !data.item) {
        toast.error(data.error ?? "無法載入預收發票");
        return;
      }
      setPrintSnapshot(buildProformaPrintSnapshot(data.item));
      setPrintDialogOpen(true);
    } catch {
      toast.error("載入失敗");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {headingTitle ?? "預收發票"}
          </h1>
          <p className="text-sm text-zinc-500">
            {headingDescription ??
              "由銷售合同一鍵開立；金額依合同所填「預收款（含稅）」拆稅後產生。"}
          </p>
        </div>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/sales/contracts">銷售合同</Link>
        </Button>
      </div>

      <div className="crm-table-shell overflow-hidden">
        <table className="w-full min-w-[880px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">發票編號</th>
              <th className="px-4 py-3">客戶</th>
              <th className="px-4 py-3">來源合同</th>
              <th className="px-4 py-3">開立日</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3 text-right">含稅總額</th>
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
                  尚無預收發票。請至「銷售合同」設定預收款後點「轉預收發票」。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.invoiceNo}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.customerName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{r.sourceContractNo}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{ymd(r.issueDate)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {STATUS_HK[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                    {fmtMoney(r.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={() => void openDownloadForRow(r)}
                    >
                      下載
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-h-[min(92vh,900px)] w-[min(96vw,56rem)] max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>下載 PDF</DialogTitle>
            <DialogDescription>以下為 A4 版面預覽；點「下載 PDF」會開啟列印視窗，請選擇「另存為 PDF」。</DialogDescription>
          </DialogHeader>
          {printSnapshot ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <ProformaInvoicePrintView org={org} {...printSnapshot} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPrintDialogOpen(false)}>
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
