"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  type DocumentLineDisplay,
  normalizeDocumentLines,
  parseDocumentItemsJsonText,
} from "@/lib/document-line-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CustomerOption = { id: string; name: string };

export type QuotationRow = {
  id: string;
  quoteNo: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  totalAmount: string;
  quoteDate: string;
  status: string;
  items: unknown;
};

type DocTab = "quotation" | "contract" | "invoice";

const TAB_LABELS: Record<DocTab, string> = {
  quotation: "報價單",
  contract: "銷售合同",
  invoice: "預收發票",
};

function fmtMoney(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(v: string): string {
  if (!v) return "—";
  const s = typeof v === "string" ? v : String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function fmtItemsJson(items: unknown): string {
  try {
    return JSON.stringify(items ?? [], null, 2);
  } catch {
    return String(items);
  }
}

type QuotationLineDisplay = DocumentLineDisplay;

function QuotationItemsTable({
  lines,
  caption,
}: {
  lines: QuotationLineDisplay[];
  caption?: string;
}) {
  const sum = lines.reduce((a, l) => a + l.lineTotal, 0);
  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {caption ?? "報價明細"}
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            <th className="px-3 py-2">#</th>
            <th className="px-3 py-2">品名</th>
            <th className="px-3 py-2">SKU</th>
            <th className="px-3 py-2 text-right">數量</th>
            <th className="px-3 py-2 text-right">單價</th>
            <th className="px-3 py-2 text-right">小計</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={`${i}-${l.name}`} className="border-b border-zinc-100 dark:border-zinc-800/80">
              <td className="px-3 py-2 tabular-nums text-zinc-500">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">{l.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">{l.sku ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(l.price)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtMoney(l.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-zinc-50/90 dark:bg-zinc-900/80">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-medium text-zinc-600 dark:text-zinc-400">
              明細合計
            </td>
            <td className="px-3 py-2 text-right tabular-nums font-semibold text-zinc-900 dark:text-zinc-50">
              {fmtMoney(sum)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function QuotationItemsBlock({ items }: { items: unknown }) {
  const lines = useMemo(() => normalizeDocumentLines(items), [items]);
  const isArray = Array.isArray(items);
  const rawLen = isArray ? items.length : 0;
  const showTable = lines.length > 0;
  const partial = showTable && rawLen > lines.length;

  return (
    <>
      <dt className="col-span-2 text-zinc-500">報價明細</dt>
      <dd className="col-span-2 space-y-3">
        {!isArray ? (
          <p className="text-sm text-zinc-500">無明細資料</p>
        ) : rawLen === 0 ? (
          <p className="text-sm text-zinc-500">尚無明細列</p>
        ) : showTable ? (
          <>
            <QuotationItemsTable lines={lines} />
            {partial ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                另有 {rawLen - lines.length} 筆無法以表格顯示（格式不完整），請展開下方原始 JSON 檢視。
              </p>
            ) : null}
            <details className="rounded-md border border-zinc-200 dark:border-zinc-700">
              <summary className="cursor-pointer select-none px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/80">
                顯示原始 JSON
              </summary>
              <pre className="max-h-40 overflow-auto border-t border-zinc-200 p-3 text-xs dark:border-zinc-700">
                {fmtItemsJson(items)}
              </pre>
            </details>
          </>
        ) : (
          <pre className="max-h-48 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-950">
            {fmtItemsJson(items)}
          </pre>
        )}
      </dd>
    </>
  );
}

function EditItemsPreview({ itemsText }: { itemsText: string }) {
  const lines = useMemo(() => parseDocumentItemsJsonText(itemsText), [itemsText]);
  const trimmed = itemsText.trim();
  if (!trimmed) return null;
  if (lines.length === 0) {
    return (
      <div className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        無法以表格預覽：請確認 JSON 為陣列，且每筆至少包含字串欄位 <code className="rounded bg-white/60 px-0.5 dark:bg-zinc-900">name</code>、數字{" "}
        <code className="rounded bg-white/60 px-0.5 dark:bg-zinc-900">qty</code>、<code className="rounded bg-white/60 px-0.5 dark:bg-zinc-900">price</code>。
      </div>
    );
  }
  return (
    <div className="sm:col-span-2 space-y-2">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">明細預覽（隨 JSON 即時更新）</p>
      <QuotationItemsTable lines={lines} caption="預覽（實際儲存內容以上方 JSON 為準）" />
    </div>
  );
}

type EditFormState = {
  quoteNo: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalAmount: string;
  quoteDate: string;
  status: string;
  itemsText: string;
};

export function SalesBillingManagement({
  customers: customerOptions,
  initialCustomerId,
  editable,
}: {
  customers: CustomerOption[];
  initialCustomerId: string | null;
  /** 業務／管理員可編輯報價；否則僅能查看 */
  editable: boolean;
}) {
  const [tab, setTab] = useState<DocTab>("quotation");
  const [customerFilter, setCustomerFilter] = useState<string>(initialCustomerId ?? "");
  /** 下拉選單旁：依名稱縮小客戶選項 */
  const [customerSelectQuery, setCustomerSelectQuery] = useState("");
  /** 列表內：依關鍵字篩選已載入的報價列 */
  const [tableSearch, setTableSearch] = useState("");
  const [rows, setRows] = useState<QuotationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewRow, setViewRow] = useState<QuotationRow | null>(null);
  const [editRow, setEditRow] = useState<QuotationRow | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadQuotations = useCallback(async (customerId: string) => {
    setLoading(true);
    setError(null);
    const qs = customerId ? `?customerId=${encodeURIComponent(customerId)}` : "";
    try {
      const res = await fetch(`/api/quotations${qs}`);
      const data = (await res.json().catch(() => ({}))) as {
        items?: QuotationRow[];
        error?: string;
        hint?: string;
      };
      if (!res.ok) {
        setError([data.error, data.hint].filter(Boolean).join(" ") || `載入失敗（${res.status}）`);
        setRows([]);
        return;
      }
      const list = (data.items ?? []) as QuotationRow[];
      setRows(
        list.map((r) => ({
          ...r,
          customerPhone: r.customerPhone ?? null,
          customerEmail: r.customerEmail ?? null,
        }))
      );
    } catch {
      setError("網路錯誤");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "quotation") {
      void loadQuotations(customerFilter);
    }
  }, [tab, customerFilter, loadQuotations]);

  useEffect(() => {
    if (!editRow) {
      setEditForm(null);
      setSaveError(null);
      return;
    }
    setEditForm({
      quoteNo: editRow.quoteNo,
      customerId: editRow.customerId ?? "",
      customerName: editRow.customerName,
      customerPhone: editRow.customerPhone ?? "",
      customerEmail: editRow.customerEmail ?? "",
      totalAmount: String(editRow.totalAmount ?? ""),
      quoteDate: fmtDate(editRow.quoteDate),
      status: editRow.status,
      itemsText: fmtItemsJson(editRow.items),
    });
    setSaveError(null);
  }, [editRow]);

  const selectedCustomerName = useMemo(() => {
    if (!customerFilter) return null;
    return customerOptions.find((c) => c.id === customerFilter)?.name ?? null;
  }, [customerFilter, customerOptions]);

  const customersForSelect = useMemo(() => {
    const q = customerSelectQuery.trim().toLowerCase();
    let list = !q ? customerOptions : customerOptions.filter((c) => c.name.toLowerCase().includes(q));
    if (customerFilter) {
      const selected = customerOptions.find((c) => c.id === customerFilter);
      if (selected && !list.some((c) => c.id === selected.id)) {
        list = [selected, ...list];
      }
    }
    return list;
  }, [customerOptions, customerSelectQuery, customerFilter]);

  const displayRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [
        r.quoteNo,
        r.customerName,
        r.status,
        String(r.totalAmount ?? ""),
        fmtDate(r.quoteDate),
        r.customerPhone ?? "",
        r.customerEmail ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, tableSearch]);

  const closeEdit = () => {
    setEditRow(null);
    setSaveError(null);
  };

  const submitEdit = async () => {
    if (!editRow || !editForm) return;
    let items: unknown[];
    try {
      items = JSON.parse(editForm.itemsText) as unknown[];
      if (!Array.isArray(items)) {
        setSaveError("明細須為 JSON 陣列");
        return;
      }
    } catch {
      setSaveError("明細 JSON 格式不正確");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/quotations/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteNo: editForm.quoteNo.trim(),
          customerId: editForm.customerId.trim() || null,
          customerName: editForm.customerName.trim(),
          customerPhone: editForm.customerPhone.trim() || null,
          customerEmail: editForm.customerEmail.trim() || null,
          totalAmount: editForm.totalAmount.trim(),
          quoteDate: editForm.quoteDate.trim(),
          status: editForm.status.trim(),
          items,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
      if (!res.ok) {
        setSaveError(data.error ?? data.detail ?? `儲存失敗（${res.status}）`);
        return;
      }
      closeEdit();
      await loadQuotations(customerFilter);
    } catch {
      setSaveError("網路錯誤");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-700"
        aria-label="商務單據類型"
      >
        {(Object.keys(TAB_LABELS) as DocTab[]).map((k) => (
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

      {tab === "quotation" ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            報價列表上方可<strong className="font-medium text-zinc-800 dark:text-zinc-200">篩選客戶</strong>（向後端載入資料）與
            <strong className="font-medium text-zinc-800 dark:text-zinc-200">搜尋列表</strong>（僅篩選目前已載入的列）。使用「查看／修改」開啟彈窗。
            {editable ? "" : "（目前帳號僅可查看報價，修改需業務／管理員權限。）"}
          </p>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : loading ? (
            <p className="text-sm text-zinc-500">載入中…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-zinc-500">尚無報價單紀錄。</p>
          ) : (
            <div className="crm-table-shell overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
              <table className="w-full min-w-[960px] border-collapse text-left text-sm [caption-side:top]">
                <caption className="w-full min-w-[960px] border-b border-zinc-200 bg-zinc-50 p-0 text-left dark:border-zinc-800 dark:bg-zinc-950/80">
                  <div className="flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[220px]">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">搜尋客戶名稱（縮小選項）</span>
                      <Input
                        placeholder="輸入關鍵字…"
                        value={customerSelectQuery}
                        onChange={(e) => setCustomerSelectQuery(e.target.value)}
                        aria-label="搜尋客戶名稱以縮小下拉選項"
                        className="h-9"
                      />
                    </div>
                    <div className="flex min-w-0 flex-col gap-1.5 sm:w-[min(100%,280px)]">
                      <label htmlFor="sales-billing-customer" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        篩選客戶（載入資料）
                      </label>
                      <Select
                        value={customerFilter || "__all__"}
                        onValueChange={(v) => setCustomerFilter(v === "__all__" ? "" : v)}
                      >
                        <SelectTrigger id="sales-billing-customer" className="h-9 w-full">
                          <SelectValue placeholder="全部客戶" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">全部客戶</SelectItem>
                          {customersForSelect.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:min-w-[200px]">
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">搜尋列表</span>
                      <Input
                        placeholder="報價單號、客戶、狀態…"
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        aria-label="搜尋目前列表"
                        className="h-9"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pb-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => void loadQuotations(customerFilter)}
                        disabled={loading}
                      >
                        重新整理
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                        <Link href="/dashboard/customers">客戶列表</Link>
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9" asChild>
                        <Link href="/dashboard/document-data-entry/quotations">報價輸入</Link>
                      </Button>
                      {customerFilter ? (
                        <Button type="button" variant="secondary" size="sm" className="h-9" asChild>
                          <Link href={`/dashboard/customers/${customerFilter}`}>客戶詳情</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {selectedCustomerName ? (
                    <p className="border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                      已向後端篩選客戶：<span className="font-medium text-zinc-900 dark:text-zinc-100">{selectedCustomerName}</span>
                      {customersForSelect.length < customerOptions.length ? (
                        <span className="text-zinc-500"> · 下拉僅顯示 {customersForSelect.length} 家（受上方搜尋影響）</span>
                      ) : null}
                    </p>
                  ) : null}
                </caption>
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-400">
                    <th className="px-3 py-3">報價單號</th>
                    <th className="px-3 py-3">客戶</th>
                    <th className="px-3 py-3 text-right">總額</th>
                    <th className="px-3 py-3">日期</th>
                    <th className="px-3 py-3">狀態</th>
                    <th className="px-3 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-sm text-zinc-500">
                        {tableSearch.trim() ? "沒有符合搜尋的報價單，請調整「搜尋列表」關鍵字。" : "尚無資料。"}
                      </td>
                    </tr>
                  ) : null}
                  {displayRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-zinc-100 dark:border-zinc-800/80 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{r.quoteNo}</td>
                      <td className="px-3 py-2">
                        {r.customerId ? (
                          <Link
                            href={`/dashboard/customers/${r.customerId}`}
                            className="text-blue-700 underline hover:no-underline dark:text-blue-400"
                          >
                            {r.customerName}
                          </Link>
                        ) : (
                          <span>{r.customerName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.totalAmount)}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtDate(r.quoteDate)}</td>
                      <td className="px-3 py-2 text-xs">{r.status}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewRow(r)}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            查看
                          </button>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => setEditRow(r)}
                              className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                            >
                              修改
                            </button>
                          ) : null}
                          {r.customerId ? (
                            <Link
                              href={`/dashboard/customers/sales-billing?customerId=${r.customerId}`}
                              className="inline-flex rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 underline dark:border-zinc-600 dark:text-zinc-400"
                            >
                              只看此客戶
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : tab === "contract" ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">銷售合同</p>
          <p className="mt-2">
            與模組 3（銷售管理）合同功能對接後，將於此顯示各客戶已簽署合同、版本與付款約定；並支援從客戶詳情一鍵帶入開立合同。
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/80 p-6 text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-400">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">預收發票</p>
          <p className="mt-2">
            與模組 3 預收發票及模組 1 財務預收款對接後，將顯示預開立發票、收款狀態與沖銷情形。
          </p>
        </div>
      )}

      <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>報價單詳情</DialogTitle>
            <DialogDescription>唯讀檢視</DialogDescription>
          </DialogHeader>
          {viewRow ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <dt className="text-zinc-500">報價單號</dt>
              <dd className="font-mono text-xs sm:col-span-1">{viewRow.quoteNo}</dd>
              <dt className="text-zinc-500">客戶</dt>
              <dd>{viewRow.customerName}</dd>
              <dt className="text-zinc-500">客戶主檔</dt>
              <dd className="font-mono text-xs">{viewRow.customerId ?? "—（未連結）"}</dd>
              <dt className="text-zinc-500">電話</dt>
              <dd>{viewRow.customerPhone ?? "—"}</dd>
              <dt className="text-zinc-500">Email</dt>
              <dd className="break-all">{viewRow.customerEmail ?? "—"}</dd>
              <dt className="text-zinc-500">總額</dt>
              <dd className="tabular-nums">{fmtMoney(viewRow.totalAmount)}</dd>
              <dt className="text-zinc-500">報價日</dt>
              <dd className="tabular-nums">{fmtDate(viewRow.quoteDate)}</dd>
              <dt className="text-zinc-500">狀態</dt>
              <dd>{viewRow.status}</dd>
              <QuotationItemsBlock items={viewRow.items} />
            </dl>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setViewRow(null)}>
              關閉
            </Button>
            {editable && viewRow ? (
              <Button
                type="button"
                onClick={() => {
                  const row = viewRow;
                  setEditRow(row);
                  setViewRow(null);
                }}
              >
                改為修改
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>修改報價單</DialogTitle>
            <DialogDescription>儲存後列表將重新載入。</DialogDescription>
          </DialogHeader>
          {editForm ? (
            <div className="space-y-4">
              {saveError ? (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950/50 dark:text-red-200">
                  {saveError}
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">報價單號 *</span>
                  <input
                    value={editForm.quoteNo}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, quoteNo: e.target.value } : f))}
                    className="rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">連結客戶主檔（選填）</span>
                  <Select
                    value={editForm.customerId || "__none__"}
                    onValueChange={(v) =>
                      setEditForm((f) => (f ? { ...f, customerId: v === "__none__" ? "" : v } : f))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="不連結主檔" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">不連結主檔</SelectItem>
                      {customerOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">客戶名稱（顯示／快照）*</span>
                  <input
                    value={editForm.customerName}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, customerName: e.target.value } : f))}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">電話</span>
                  <input
                    value={editForm.customerPhone}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, customerPhone: e.target.value } : f))}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">Email</span>
                  <input
                    type="email"
                    value={editForm.customerEmail}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, customerEmail: e.target.value } : f))}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">報價日 *</span>
                  <input
                    type="date"
                    value={editForm.quoteDate}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, quoteDate: e.target.value } : f))}
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">總額 *</span>
                  <input
                    value={editForm.totalAmount}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, totalAmount: e.target.value } : f))}
                    className="rounded-md border border-zinc-300 px-3 py-2 tabular-nums dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">狀態 *</span>
                  <input
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, status: e.target.value } : f))}
                    placeholder="如：Draft、Sent"
                    className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                  <span className="text-zinc-600 dark:text-zinc-400">明細（JSON 陣列，儲存用）*</span>
                  <textarea
                    value={editForm.itemsText}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, itemsText: e.target.value } : f))}
                    rows={8}
                    className="font-mono text-xs rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
                <EditItemsPreview itemsText={editForm.itemsText} />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeEdit} disabled={saving}>
              取消
            </Button>
            <Button type="button" onClick={() => void submitEdit()} disabled={saving || !editForm}>
              {saving ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
