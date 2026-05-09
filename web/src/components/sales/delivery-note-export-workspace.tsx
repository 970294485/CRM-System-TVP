"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  DeliveryNotePrintView,
  type DeliveryNotePrintLine,
  type DeliveryNotePrintViewProps,
} from "@/components/sales/delivery-note-print-view";
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

type DeliveryListRow = {
  id: string;
  dnNo: string;
  contractId: string;
  sourceContractNo: string;
  customerName: string;
  shipDate: string;
  status: string;
  createdAt: string;
};

type DnDetail = {
  id: string;
  dnNo: string;
  shipDate: string;
  sourceContractNo: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  shipToAddress: string | null;
  items: unknown;
  notes: string | null;
};

const STATUS_HK: Record<string, string> = {
  Draft: "草稿",
  Issued: "已發出",
  Cancelled: "已作廢",
};

function itemsToPrintLines(items: unknown): DeliveryNotePrintLine[] {
  if (!Array.isArray(items)) return [];
  const out: DeliveryNotePrintLine[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const qty = Number(o.qty);
    const sku = o.sku != null ? String(o.sku).trim() : "";
    if (!name && !sku && !Number.isFinite(qty)) continue;
    out.push({
      name: name || "—",
      sku: sku || null,
      qty: Number.isFinite(qty) ? qty : 0,
    });
  }
  return out;
}

function buildPrintSnapshot(row: DnDetail): Omit<DeliveryNotePrintViewProps, "org"> {
  const ship = typeof row.shipDate === "string" ? row.shipDate.slice(0, 10) : String(row.shipDate ?? "");
  return {
    dnNo: row.dnNo,
    shipDate: ship,
    sourceContractNo: row.sourceContractNo,
    statusLabel: STATUS_HK[row.status] ?? row.status,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    shipToAddress: row.shipToAddress,
    lines: itemsToPrintLines(row.items),
    notes: row.notes,
  };
}

type Props = { org: QuotationPrintOrg };

export function DeliveryNoteExportWorkspace({ org }: Props) {
  const [rows, setRows] = useState<DeliveryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listHint, setListHint] = useState<string | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<Omit<DeliveryNotePrintViewProps, "org"> | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListHint(null);
    try {
      const res = await fetch("/api/sales/delivery-notes", { credentials: "same-origin" });
      const data = (await res.json()) as { items?: DeliveryListRow[]; error?: string; hint?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法讀取送貨單");
        if (data.hint) toast.message(data.hint);
        setRows([]);
        return;
      }
      setRows(data.items ?? []);
      if (data.hint) setListHint(data.hint);
    } catch {
      toast.error("無法載入送貨單");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openExportForRow = async (r: DeliveryListRow) => {
    try {
      const res = await fetch(`/api/sales/delivery-notes/${r.id}`, { credentials: "same-origin" });
      const data = (await res.json()) as { item?: DnDetail; error?: string };
      if (!res.ok || !data.item) {
        toast.error(data.error ?? "無法載入送貨單");
        return;
      }
      setPrintSnapshot(buildPrintSnapshot(data.item));
      setPrintOpen(true);
    } catch {
      toast.error("載入失敗");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">導出 DELIVERY NOTE</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          僅提供既有送貨單之預覽與 PDF（瀏覽器列印 → 另存 PDF）。開立與庫存核對請至「銷售管理 › 送貨管理」。
        </p>
        <p className="text-sm">
          <Link
            href="/dashboard/sales/delivery-notes"
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            前往送貨管理
          </Link>
          <span className="text-zinc-500"> · </span>
          <Link
            href="/dashboard/doc-master?tab=numbering"
            className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
          >
            文件編號（DN-）
          </Link>
        </p>
      </header>

      {listHint ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100"
        >
          {listHint}
        </div>
      ) : null}

      <div className="crm-table-shell overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[800px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">送貨單號</th>
              <th className="px-4 py-3">來源合同</th>
              <th className="px-4 py-3">客戶</th>
              <th className="px-4 py-3">出貨日</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  載入中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  尚無送貨單可導出。請至送貨管理開立後再回到此頁。
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">{r.dnNo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{r.sourceContractNo}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.customerName}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{r.shipDate}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {STATUS_HK[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => void openExportForRow(r)}>
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
            <DialogTitle>導出 DELIVERY NOTE</DialogTitle>
            <DialogDescription>以下為 A4 預覽；點「下載 PDF」開啟列印並選擇「另存為 PDF」。</DialogDescription>
          </DialogHeader>
          {printSnapshot ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <DeliveryNotePrintView org={org} {...printSnapshot} />
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
