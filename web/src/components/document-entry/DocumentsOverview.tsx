"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InventoryLinkedReceiptsButton,
  PurchaseOrderReceiptsButton,
} from "@/components/document-entry/po-inventory-link-dialogs";
import { formatLineMoney, lineItemsToTooltipSummary, normalizeDocumentLines } from "@/lib/document-line-items";

export type DocumentsOverviewTabKey = "quotation" | "po" | "inventory";

type TabKey = DocumentsOverviewTabKey;

export type DocumentsOverviewProps = {
  cardTitle?: string;
  cardDescription?: ReactNode;
  /** 開啟頁面時預設分頁 */
  initialTab?: TabKey;
  /** 分頁按鈕順序；預設為報價單 → 採購單 → 庫存 */
  tabOrder?: TabKey[];
};

const TAB_LABELS: Record<TabKey, string> = {
  quotation: "報價單",
  po: "採購單",
  inventory: "庫存信息",
};

function fmtMoney(v: unknown): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: unknown): string {
  if (v == null || v === "") return "—";
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

/** Drizzle 多為 camelCase；raw SQL 多為 snake_case */
function pickCustomerFields(r: Record<string, unknown>): {
  name: string;
  id: string;
  phone: string;
  email: string;
} {
  return {
    name: String(r.customer_name ?? r.customerName ?? "").trim(),
    id: String(r.customer_id ?? r.customerId ?? "").trim(),
    phone: String(r.customer_phone ?? r.customerPhone ?? "").trim(),
    email: String(r.customer_email ?? r.customerEmail ?? "").trim(),
  };
}

type OrderPartyRole = "customer" | "supplier";

function compactOrderPartyLabel(r: Record<string, unknown>, role: OrderPartyRole): string | null {
  const c = pickCustomerFields(r);
  const parts: string[] = [];
  if (c.name) parts.push(c.name);
  else if (role === "customer" && c.id) parts.push(`客戶 ID ${c.id}`);
  if (c.phone) parts.push(c.phone);
  if (c.email) parts.push(c.email);
  return parts.length ? parts.join(" · ") : null;
}

function orderPartyDetailTitle(items: unknown, r: Record<string, unknown>, role: OrderPartyRole): string {
  const linesTip = lineItemsToTooltipSummary(items);
  const cust = pickCustomerFields(r);
  const partyLabel = role === "supplier" ? "供應商" : "客戶";
  const custLines: string[] = [];
  if (cust.name) custLines.push(`${partyLabel}：${cust.name}`);
  if (role === "customer" && cust.id) custLines.push(`客戶 ID：${cust.id}`);
  if (cust.phone) custLines.push(`電話：${cust.phone}`);
  if (cust.email) custLines.push(`Email：${cust.email}`);
  const head = custLines.join("\n");
  return head ? `${head}\n\n${linesTip}` : linesTip;
}

function DocumentItemsCell({
  items,
  partyHint,
  partyCaption,
}: {
  items: unknown;
  /** 單據層對象摘要（報價＝客戶；採購＝供應商），顯示在明細上方 */
  partyHint?: string | null;
  /** 明細區塊標題，例如「客戶」或「供應商」 */
  partyCaption: string;
}) {
  const lines = useMemo(() => normalizeDocumentLines(items), [items]);
  const hint = partyHint?.trim() ? (
    <p className="mb-2 border-b border-zinc-200/80 pb-2 text-[11px] leading-snug text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{partyCaption}</span>{" "}
      <span className="text-zinc-800 dark:text-zinc-200">{partyHint.trim()}</span>
    </p>
  ) : null;

  if (lines.length === 0) {
    if (items == null) {
      return hint ? (
        <div>
          {hint}
          <span className="text-zinc-400">—</span>
        </div>
      ) : (
        <span className="text-zinc-400">—</span>
      );
    }
    let raw: string;
    try {
      raw = typeof items === "string" ? items : JSON.stringify(items, null, 2);
    } catch {
      raw = String(items);
    }
    return (
      <div>
        {hint}
        <pre className="max-h-36 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {raw}
        </pre>
      </div>
    );
  }

  return (
    <div>
      {hint}
      <ul className="list-none space-y-2">
        {lines.map((l, i) => (
          <li
            key={`${i}-${l.sku ?? ""}-${l.name}`}
            className="rounded-md border border-zinc-200/90 bg-gradient-to-b from-white to-zinc-50/95 px-2.5 py-2 text-xs shadow-sm dark:border-zinc-600 dark:from-zinc-900 dark:to-zinc-950/95"
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium text-zinc-900 dark:text-zinc-50">{l.name}</span>
              {l.sku ? (
                <span className="rounded bg-zinc-100 px-1.5 py-px font-mono text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {l.sku}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 tabular-nums text-[11px] text-zinc-600 dark:text-zinc-400">
              <span>數量 {l.qty}</span>
              <span>單價 {formatLineMoney(l.price)}</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">小計 {formatLineMoney(l.lineTotal)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DEFAULT_TAB_ORDER: TabKey[] = ["quotation", "po", "inventory"];

export function DocumentsOverview({
  cardTitle,
  cardDescription,
  initialTab = "quotation",
  tabOrder,
}: DocumentsOverviewProps = {}) {
  const order = tabOrder?.length ? tabOrder : DEFAULT_TAB_ORDER;
  const showTabSwitcher = order.length > 1;
  const resolvedInitial: TabKey = order.includes(initialTab) ? initialTab : (order[0] ?? "quotation");
  const [tab, setTab] = useState<TabKey>(resolvedInitial);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: TabKey) => {
    setLoading(true);
    setError(null);
    const path =
      t === "quotation" ? "/api/quotations" : t === "po" ? "/api/purchase-orders" : "/api/inventory";
    try {
      const res = await fetch(path);
      const data = (await res.json().catch(() => ({}))) as {
        items?: Record<string, unknown>[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(" ") || `載入失敗（${res.status}）`);
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
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const defaultDescription = (
    <>
      檢視已匯入資料。採購單可點「入庫關聯」查看 <code className="text-xs">purchase_order_receipts</code>；庫存列可點「採購入庫關聯」對照相同產品與倉位之入庫。採購單之「供應商」為採購對象名稱／聯繫等快照，與銷售端「客戶」模組無必然對應。採購匯入時若明細可解析到產品（
      <code className="text-xs">product_id</code> 或 <code className="text-xs">sku</code> 對應{" "}
      <code className="text-xs">products</code>
      ），會寫入 <code className="text-xs">purchase_order_receipts</code> 並累加{" "}
      <code className="text-xs">inventory</code>。寫入請使用{" "}
      <code className="rounded bg-zinc-100 px-1 text-xs dark:bg-zinc-800">POST /api/import-documents</code>。
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{cardTitle ?? "報價單、採購單及庫存信息"}</CardTitle>
        <CardDescription>{cardDescription ?? defaultDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {showTabSwitcher ? (
          <div
            role="tablist"
            className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700"
            aria-label="資料類型"
          >
            {order.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                className={
                  tab === k
                    ? "-mb-px border-b-2 border-zinc-900 px-3 py-2 text-sm font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-50"
                    : "px-3 py-2 text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }
                onClick={() => setTab(k)}
              >
                {TAB_LABELS[k]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => void load(tab)} disabled={loading}>
            重新整理
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : loading ? (
          <p className="text-sm text-zinc-500">載入中…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">尚無資料。</p>
        ) : tab === "quotation" ? (
          <div className="crm-table-shell overflow-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                  <th className="px-3 py-3">報價單號</th>
                  <th className="px-3 py-3">客戶名稱</th>
                  <th className="px-3 py-3">客戶 ID</th>
                  <th className="px-3 py-3">聯繫</th>
                  <th className="px-3 py-3 text-right">總額</th>
                  <th className="px-3 py-3">日期</th>
                  <th className="px-3 py-3">狀態</th>
                  <th className="px-3 py-3">明細摘要</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cust = pickCustomerFields(r);
                  const quoteNo = String(r.quote_no ?? r.quoteNo ?? "");
                  const contact = [cust.phone, cust.email].filter(Boolean).join(" · ") || "—";
                  return (
                    <tr
                      key={String(r.id ?? quoteNo)}
                      className="border-b border-zinc-100 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{quoteNo}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2" title={cust.name || undefined}>
                        {cust.name || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-500">{cust.id || "—"}</td>
                      <td className="max-w-[11rem] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400" title={contact !== "—" ? contact : undefined}>
                        {contact}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.total_amount ?? r.totalAmount)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDate(r.quote_date ?? r.quoteDate)}</td>
                      <td className="px-3 py-2 text-xs">{String(r.status ?? "—")}</td>
                      <td
                        className="min-w-[12rem] max-w-[min(22rem,100%)] align-top px-3 py-2 text-zinc-600 dark:text-zinc-400"
                        title={orderPartyDetailTitle(r.items, r, "customer")}
                      >
                        <DocumentItemsCell
                          items={r.items}
                          partyCaption="客戶"
                          partyHint={compactOrderPartyLabel(r, "customer")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : tab === "po" ? (
          <div className="crm-table-shell overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                  <th className="px-3 py-3">採購單號</th>
                  <th className="px-3 py-3">舊系統編號</th>
                  <th className="px-3 py-3">供應商名稱</th>
                  <th className="px-3 py-3">聯繫</th>
                  <th className="px-3 py-3 text-right">總額</th>
                  <th className="px-3 py-3">採購日</th>
                  <th className="px-3 py-3">狀態</th>
                  <th className="px-3 py-3">付款</th>
                  <th className="px-3 py-3 text-right">已付</th>
                  <th className="px-3 py-3 whitespace-nowrap">入庫關聯</th>
                  <th className="px-3 py-3 whitespace-nowrap">請款</th>
                  <th className="px-3 py-3">明細摘要</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cust = pickCustomerFields(r);
                  const contact = [cust.phone, cust.email].filter(Boolean).join(" · ") || "—";
                  const poNo = String(r.po_no ?? r.poNo ?? "");
                  const poId = String(r.id ?? "").trim();
                  const financeApHref =
                    poId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(poId)
                      ? `/dashboard/finance/payment-requests-advances?tab=ap&poId=${encodeURIComponent(poId)}`
                      : null;
                  return (
                    <tr
                      key={String(r.id ?? poNo)}
                      className="border-b border-zinc-100 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{poNo}</td>
                      <td className="px-3 py-2 text-xs">{String(r.original_system_id ?? r.originalSystemId ?? "—")}</td>
                      <td className="max-w-[10rem] truncate px-3 py-2" title={cust.name || undefined}>
                        {cust.name || "—"}
                      </td>
                      <td className="max-w-[11rem] truncate px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400" title={contact !== "—" ? contact : undefined}>
                        {contact}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.total_amount ?? r.totalAmount)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDate(r.po_date ?? r.poDate)}</td>
                      <td className="px-3 py-2 text-xs">{String(r.status ?? "—")}</td>
                      <td className="px-3 py-2 text-xs">{String(r.payment_status ?? r.paymentStatus ?? "—")}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.paid_amount ?? r.paidAmount)}</td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        <PurchaseOrderReceiptsButton
                          purchaseOrderId={poId}
                          poNo={poNo}
                          receiptLineCount={Number(r.receipt_line_count ?? 0)}
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle">
                        {financeApHref ? (
                          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                            <Link href={financeApHref}>建立請款</Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                      <td
                        className="min-w-[12rem] max-w-[min(22rem,100%)] align-top px-3 py-2 text-zinc-600 dark:text-zinc-400"
                        title={orderPartyDetailTitle(r.items, r, "supplier")}
                      >
                        <DocumentItemsCell
                          items={r.items}
                          partyCaption="供應商"
                          partyHint={compactOrderPartyLabel(r, "supplier")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="crm-table-shell overflow-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">產品 ID</th>
                  <th className="px-3 py-3">倉位</th>
                  <th className="px-3 py-3 text-right">庫存</th>
                  <th className="px-3 py-3 text-right">單位成本</th>
                  <th className="px-3 py-3">盤點日</th>
                  <th className="px-3 py-3 whitespace-nowrap">採購入庫關聯</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={String(r.id ?? `${r.sku}-${r.warehouse_location}`)}
                    className="border-b border-zinc-100 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{String(r.sku ?? "")}</td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-500">{String(r.product_id ?? "")}</td>
                    <td className="px-3 py-2">{String(r.warehouse_location ?? "—")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{String(r.stock_qty ?? "—")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.unit_cost)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtDate(r.last_counted_date)}</td>
                    <td className="whitespace-nowrap px-3 py-2 align-middle">
                      <InventoryLinkedReceiptsButton
                        inventoryId={String(r.id ?? "")}
                        receiptLinkCount={Number(r.receipt_link_count ?? 0)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
