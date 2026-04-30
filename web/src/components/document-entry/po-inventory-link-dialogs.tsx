"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function fmtMoney(v: string | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 庫存列：查看與本列 product_id + 倉位 一致的採購入庫（與 receipt_link_count 同規則） */
export function InventoryLinkedReceiptsButton({
  inventoryId,
  receiptLinkCount,
}: {
  inventoryId: string;
  receiptLinkCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    {
      id: string;
      purchaseOrderId: string;
      poNo: string;
      sku: string;
      qtyReceived: number;
      warehouseLocation: string | null;
      unitCost: string | null;
      lineNameSnapshot: string | null;
      receivedAt: string;
    }[]
  >([]);

  const load = useCallback(async () => {
    if (!UUID_RE.test(inventoryId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/${inventoryId}/linked-receipts`, {
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: typeof rows;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "載入失敗");
        setRows([]);
        return;
      }
      setRows(data.items ?? []);
    } catch {
      setError("網路錯誤");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [inventoryId]);

  if (!UUID_RE.test(inventoryId)) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  if (receiptLinkCount <= 0) {
    return <span className="text-xs text-zinc-400">0</span>;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        查看 {receiptLinkCount} 筆
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>採購入庫關聯</DialogTitle>
            <DialogDescription>
              與此庫存列相同產品、相同倉位（含皆為空）之{" "}
              <code className="text-xs">purchase_order_receipts</code> 紀錄，對應採購單號如下。
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-zinc-500">載入中…</p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無資料。</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 pb-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <Link href="/dashboard/document-data-entry/purchase-orders">開啟採購單列表</Link>
                </Button>
              </div>
              <div className="crm-table-shell overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs dark:border-zinc-600 dark:bg-zinc-800/80">
                    <th className="px-2 py-2">採購單號</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="px-2 py-2 text-right">入庫數</th>
                    <th className="px-2 py-2">倉位</th>
                    <th className="px-2 py-2 text-right">單位成本</th>
                    <th className="px-2 py-2">入庫時間</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 font-mono text-xs">
                        <Link
                          href="/dashboard/document-data-entry/purchase-orders"
                          className="text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                          {r.poNo}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-xs">{r.sku}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.qtyReceived}</td>
                      <td className="px-2 py-1.5 text-xs">{r.warehouseLocation ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.unitCost)}</td>
                      <td className="px-2 py-1.5 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                        {r.receivedAt?.slice(0, 19)?.replace("T", " ") ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 採購單列：查看本單入庫明細（對應庫存累加依據） */
export function PurchaseOrderReceiptsButton({
  purchaseOrderId,
  poNo,
  receiptLineCount,
}: {
  purchaseOrderId: string;
  poNo: string;
  receiptLineCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<
    {
      id: string;
      productId: string;
      sku: string;
      qtyReceived: number;
      warehouseLocation: string | null;
      unitCost: string | null;
      lineNameSnapshot: string | null;
      receivedAt: string;
    }[]
  >([]);

  const load = useCallback(async () => {
    if (!UUID_RE.test(purchaseOrderId)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${purchaseOrderId}/receipts`, {
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        items?: typeof rows;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "載入失敗");
        setRows([]);
        return;
      }
      setRows(data.items ?? []);
    } catch {
      setError("網路錯誤");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [purchaseOrderId]);

  if (!UUID_RE.test(purchaseOrderId)) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  if (receiptLineCount <= 0) {
    return <span className="text-xs text-zinc-400">0</span>;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        入庫 {receiptLineCount} 筆
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>採購入庫明細 · {poNo}</DialogTitle>
            <DialogDescription>
              本採購單之入庫紀錄；匯入時可寫入庫存{" "}
              <code className="text-xs">inventory</code>。可至「庫存信息」依 SKU／倉位核對現量。
            </DialogDescription>
          </DialogHeader>
          {loading ? (
            <p className="text-sm text-zinc-500">載入中…</p>
          ) : error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無資料。</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 pb-2">
                <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                  <Link href="/dashboard/document-data-entry/inventory">開啟庫存信息</Link>
                </Button>
              </div>
              <div className="crm-table-shell overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs dark:border-zinc-600 dark:bg-zinc-800/80">
                      <th className="px-2 py-2">品項摘要</th>
                      <th className="px-2 py-2">SKU</th>
                      <th className="px-2 py-2">產品 ID</th>
                      <th className="px-2 py-2 text-right">入庫數</th>
                      <th className="px-2 py-2">倉位</th>
                      <th className="px-2 py-2 text-right">單位成本</th>
                      <th className="px-2 py-2">入庫時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="max-w-[10rem] truncate px-2 py-1.5 text-xs" title={r.lineNameSnapshot ?? ""}>
                          {r.lineNameSnapshot ?? "—"}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-xs">{r.sku}</td>
                        <td className="px-2 py-1.5 font-mono text-xs text-zinc-500">{r.productId}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.qtyReceived}</td>
                        <td className="px-2 py-1.5 text-xs">{r.warehouseLocation ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(r.unitCost)}</td>
                        <td className="px-2 py-1.5 text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
                          {r.receivedAt?.slice(0, 19)?.replace("T", " ") ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
