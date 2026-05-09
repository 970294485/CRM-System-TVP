"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { previewNextDocumentLabel } from "@/actions/pt-data-master";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ContractRow = {
  id: string;
  contractNo: string;
  customerName: string;
  contractDate: string;
  status: string;
};

type ContractDetail = {
  id: string;
  contractNo: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  items: unknown;
};

type LineRow = {
  name: string;
  sku: string;
  qty: number;
  product_id: string | null;
  stockQty: number | null;
};

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

function hkYmd(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: "Asia/Hong_Kong", hour12: false }).slice(0, 10);
}

function parseLines(items: unknown): Omit<LineRow, "stockQty">[] {
  if (!Array.isArray(items)) return [];
  const out: Omit<LineRow, "stockQty">[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    const qty = Number(o.qty);
    const sku = o.sku != null ? String(o.sku).trim() : "";
    const product_id =
      typeof o.product_id === "string" && /^[0-9a-f-]{36}$/i.test(o.product_id) ? o.product_id : null;
    if (!name && !sku && !Number.isFinite(qty)) continue;
    out.push({
      name: name || "—",
      sku,
      qty: Number.isFinite(qty) ? qty : 0,
      product_id,
    });
  }
  return out;
}

export function DeliveryNotesWorkspace() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [contractDetail, setContractDetail] = useState<ContractDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [lines, setLines] = useState<LineRow[]>([]);

  const [dnList, setDnList] = useState<DeliveryListRow[]>([]);
  const [dnLoading, setDnLoading] = useState(true);
  const [dnListHint, setDnListHint] = useState<string | null>(null);

  const [nextDnPreview, setNextDnPreview] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [shipDate, setShipDate] = useState(hkYmd);
  const [shipNotes, setShipNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const loadContracts = useCallback(async () => {
    setContractsLoading(true);
    try {
      const res = await fetch("/api/sales/contracts", { credentials: "same-origin" });
      const data = (await res.json()) as { items?: ContractRow[]; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法載入銷售合同");
        return;
      }
      const items = (data.items ?? []).filter((r) => r.status !== "Cancelled");
      setContracts(items);
    } catch {
      toast.error("無法載入銷售合同");
    } finally {
      setContractsLoading(false);
    }
  }, []);

  const loadDnList = useCallback(async () => {
    setDnLoading(true);
    try {
      setDnListHint(null);
      const res = await fetch("/api/sales/delivery-notes", { credentials: "same-origin" });
      const data = (await res.json()) as { items?: DeliveryListRow[]; error?: string; hint?: string };
      if (!res.ok) {
        toast.error(data.error ?? "無法讀取送貨單");
        if (data.hint) toast.message(data.hint);
        return;
      }
      setDnList(data.items ?? []);
      if (data.hint) setDnListHint(data.hint);
    } catch {
      toast.error("無法載入送貨單");
    } finally {
      setDnLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
    void loadDnList();
    previewNextDocumentLabel("delivery_note").then(setNextDnPreview).catch(() => setNextDnPreview(null));
  }, [loadContracts, loadDnList]);

  useEffect(() => {
    if (!selectedContractId) {
      setContractDetail(null);
      setLines([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/sales/contracts/${selectedContractId}`, { credentials: "same-origin" });
        const data = (await res.json()) as { item?: ContractDetail; error?: string };
        if (!res.ok) {
          toast.error(data.error ?? "無法載入合同明細");
          setContractDetail(null);
          setLines([]);
          return;
        }
        if (cancelled) return;
        const item = data.item!;
        setContractDetail(item);
        const base = parseLines(item.items);
        const stockLines = base.map((b) => ({ ...b, stockQty: null as number | null }));
        setLines(stockLines);

        const hintRes = await fetch("/api/inventory/stock-hints", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: base.map((b) => ({ product_id: b.product_id, sku: b.sku || null })),
          }),
        });
        const hintData = (await hintRes.json()) as { hints?: { stockQty: number | null }[] };
        if (!hintRes.ok || !hintData.hints) {
          setLines(stockLines);
          return;
        }
        if (cancelled) return;
        setLines(
          base.map((b, i) => ({
            ...b,
            stockQty: hintData.hints![i]?.stockQty ?? null,
          }))
        );
      } catch {
        toast.error("載入合同或庫存失敗");
        setContractDetail(null);
        setLines([]);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedContractId]);

  const openCreate = () => {
    if (!contractDetail) {
      toast.message("請先選擇銷售合同");
      return;
    }
    setShipDate(hkYmd());
    setShipNotes("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!contractDetail) return;
    setCreating(true);
    try {
      const res = await fetch("/api/sales/delivery-notes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractDetail.id,
          ship_date: shipDate,
          notes: shipNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as { error?: string; hint?: string; item?: DeliveryListRow };
      if (!res.ok) {
        toast.error(data.error ?? "開立失敗");
        if (data.hint) toast.message(data.hint);
        return;
      }
      toast.success(`已開立 ${data.item?.dnNo ?? ""}`);
      setCreateOpen(false);
      await loadDnList();
      previewNextDocumentLabel("delivery_note").then(setNextDnPreview).catch(() => setNextDnPreview(null));
    } catch {
      toast.error("開立失敗");
    } finally {
      setCreating(false);
    }
  };

  const selectedContractLabel = useMemo(() => {
    const r = contracts.find((c) => c.id === selectedContractId);
    return r ? `${r.contractNo} · ${r.customerName}` : "";
  }, [contracts, selectedContractId]);

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">送貨管理</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          依銷售合同開立送貨單（DN-），帶入客戶與出貨明細並對照庫存；編號規則見文件主檔「delivery_note」。列印／PDF 請至「文件導出 › 導出
          DELIVERY NOTE」。
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">銷售合同 · 出貨標的與客戶資訊</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          選擇合同後載入明細（已取消的合同不在清單中）。送貨地址於開立送貨單時自客戶主檔快照。
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Label htmlFor="dn-contract" className="text-xs text-zinc-600 dark:text-zinc-400">
              銷售合同
            </Label>
            <select
              id="dn-contract"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-950"
              value={selectedContractId}
              disabled={contractsLoading}
              onChange={(e) => setSelectedContractId(e.target.value)}
            >
              <option value="">{contractsLoading ? "載入中…" : "請選擇合同"}</option>
              {contracts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNo} · {c.customerName} ({c.status}) · {c.contractDate}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/sales/contracts">前往銷售合同列表</Link>
          </Button>
          <Button type="button" size="sm" disabled={!contractDetail || detailLoading} onClick={openCreate}>
            開立送貨單
          </Button>
        </div>

        {detailLoading ? (
          <p className="mt-4 text-sm text-zinc-500">載入合同明細…</p>
        ) : contractDetail ? (
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-700 dark:text-zinc-300">
              <span>
                <span className="text-zinc-500">客戶</span> {contractDetail.customerName}
              </span>
              {contractDetail.customerPhone ? (
                <span>
                  <span className="text-zinc-500">電話</span> {contractDetail.customerPhone}
                </span>
              ) : null}
              {contractDetail.customerEmail ? (
                <span>
                  <span className="text-zinc-500">信箱</span> {contractDetail.customerEmail}
                </span>
              ) : null}
            </div>
          </div>
        ) : selectedContractId ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">無法顯示此合同。</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">對應庫單 · 庫存／入庫數量核對參考</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          「現有庫存」為 <code className="rounded bg-zinc-100 px-1 text-[11px] dark:bg-zinc-800">inventory</code>{" "}
          表依產品 ID 或 SKU 加總（多倉相加）；入庫明細請於採購對接頁查核。
        </p>
        <div className="mt-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/dashboard/sales/stock-purchase-docking">前往對應庫單和採購對接功能</Link>
          </Button>
        </div>
        <div className="crm-table-shell mt-4 overflow-hidden">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-3 py-2">品名</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">合同數量</th>
                <th className="px-3 py-2 text-right">現有庫存</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                    {selectedContractId ? "此合同無有效明細列。" : "請先選擇銷售合同。"}
                  </td>
                </tr>
              ) : (
                lines.map((row, i) => (
                  <tr
                    key={`${row.name}-${row.sku}-${i}`}
                    className="border-b border-zinc-100 dark:border-zinc-800/80"
                  >
                    <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {row.sku || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.qty}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {row.stockQty != null ? row.stockQty : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">文件編號 · DN-（送貨單）</h2>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          取號鍵為 <code className="rounded bg-zinc-100 px-1 text-[11px] dark:bg-zinc-800">delivery_note</code>
          ；開立送貨單時會併發遞增序列。
        </p>
        <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">
          下一號預覽：<span className="font-mono font-medium">{nextDnPreview ?? "—"}</span>
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/dashboard/doc-master?tab=numbering">前往文件編號及基礎資料管理</Link>
        </Button>
      </section>

      {dnListHint ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100"
        >
          {dnListHint}
        </div>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">已開立送貨單</h2>
        <div className="crm-table-shell overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <th className="px-4 py-3">送貨單號</th>
                <th className="px-4 py-3">來源合同</th>
                <th className="px-4 py-3">客戶</th>
                <th className="px-4 py-3">出貨日</th>
                <th className="px-4 py-3">狀態</th>
              </tr>
            </thead>
            <tbody>
              {dnLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    載入中…
                  </td>
                </tr>
              ) : dnList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    尚無送貨單，請選擇合同後開立。
                  </td>
                </tr>
              ) : (
                dnList.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-800 dark:text-zinc-200">{r.dnNo}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {r.sourceContractNo}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.customerName}</td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{r.shipDate}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>開立送貨單</DialogTitle>
            <DialogDescription>
              將自合同「{selectedContractLabel}」快照客戶與明細；編號：{nextDnPreview ?? "（開立時分配）"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="ship-date">出貨日</Label>
              <Input
                id="ship-date"
                type="date"
                value={shipDate}
                onChange={(e) => setShipDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="ship-notes">備註（選填）</Label>
              <Input
                id="ship-notes"
                value={shipNotes}
                onChange={(e) => setShipNotes(e.target.value)}
                placeholder="車次、联系人等"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={creating} onClick={() => void submitCreate()}>
              {creating ? "開立中…" : "確認開立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
