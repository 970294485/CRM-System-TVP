"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QuotationEditor,
  type CustomerOption,
  type QuotationFormValues,
  emptyQuotationDefaults,
} from "@/components/sales/quotation-editor";
import { QuotationPrintView, type QuotationPrintOrg } from "@/components/sales/quotation-print-view";
import { lineTotalFromInputs, totalsFromLines } from "@/lib/sales/quotation-math";
import { quotationStatusLabelHk } from "@/lib/sales/quotation-status-hk";

type ApiQuotation = {
  id: string;
  quoteNo: string;
  customerId: string | null;
  customerName: string;
  customerCode?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  quoteDate: string;
  validUntil?: string | null;
  items: unknown;
  subtotal?: string | null;
  taxRate?: string | null;
  taxAmount?: string | null;
  totalAmount: string;
  status: string;
  notes?: string | null;
};

function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  return v.toISOString().slice(0, 10);
}

function fmtMoney(v: string | number | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeItemFromApi(raw: unknown): QuotationFormValues["items"][number] | null {
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
  const line_total =
    o.line_total != null && Number.isFinite(Number(o.line_total))
      ? Number(o.line_total)
      : lineTotalFromInputs(qty, unit, discount);
  const product_id =
    typeof o.product_id === "string" && o.product_id.length > 0 ? o.product_id : null;
  const sku = o.sku != null ? String(o.sku) : "";
  return {
    product_id,
    sku,
    name,
    qty: Number.isFinite(qty) ? qty : 0,
    unit_price: unit,
    discount,
    line_total,
  };
}

function apiToFormValues(row: ApiQuotation): QuotationFormValues {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems.map(normalizeItemFromApi).filter((x): x is NonNullable<typeof x> => x != null);
  const safeItems =
    items.length > 0
      ? items
      : [
          {
            product_id: null,
            sku: "",
            name: "",
            qty: 1,
            unit_price: 0,
            discount: 0,
            line_total: 0,
          },
        ];

  return {
    customer_id: row.customerId ?? "",
    quote_date: ymd(row.quoteDate) || emptyQuotationDefaults().quote_date,
    valid_until: ymd(row.validUntil) || addDays(ymd(row.quoteDate) || emptyQuotationDefaults().quote_date, 7),
    tax_rate: row.taxRate != null && row.taxRate !== "" ? Number(row.taxRate) : 5,
    notes: row.notes ?? "",
    status: ["Draft", "Sent", "Accepted", "Expired", "Converted"].includes(row.status)
      ? row.status
      : "Draft",
    items: safeItems,
  };
}

function addDays(ymdStr: string, d: number): string {
  const dt = new Date(`${ymdStr}T12:00:00`);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
}

function formToApiPayload(values: QuotationFormValues) {
  return {
    customer_id: values.customer_id,
    quote_date: values.quote_date,
    valid_until: values.valid_until,
    tax_rate: values.tax_rate,
    notes: values.notes?.trim() ? values.notes.trim() : null,
    status: values.status,
    items: values.items.map((l) => ({
      product_id: l.product_id,
      sku: l.sku?.trim() ? l.sku.trim() : null,
      name: l.name.trim(),
      qty: l.qty,
      unit_price: l.unit_price,
      discount: l.discount ?? 0,
    })),
  };
}

function buildPrintSnapshot(
  row: ApiQuotation | null,
  v: QuotationFormValues,
  customerCache: CustomerOption | null
) {
  const lines = v.items.map((l) => ({
    name: l.name,
    sku: l.sku?.trim() ? l.sku : null,
    qty: l.qty,
    unit_price: l.unit_price,
    discount: l.discount ?? 0,
    line_total: lineTotalFromInputs(l.qty, l.unit_price, l.discount ?? 0),
  }));
  const { subtotal, tax_amount, total_amount } = totalsFromLines(
    lines.map((l) => l.line_total),
    v.tax_rate
  );
  const custName = customerCache?.name ?? row?.customerName ?? (v.customer_id ? "（客戶）" : "—");
  return {
    quoteNo: row?.quoteNo ?? "（尚未儲存）",
    quoteDate: v.quote_date,
    validUntil: v.valid_until,
    customerName: custName,
    customerCode: customerCache?.customerCode ?? row?.customerCode ?? null,
    contactName: customerCache?.contactName,
    customerPhone: customerCache?.phone ?? row?.customerPhone,
    customerEmail: customerCache?.email ?? row?.customerEmail,
    customerAddress: customerCache?.address,
    lines,
    subtotal,
    taxRate: v.tax_rate,
    taxAmount: tax_amount,
    totalAmount: total_amount,
    notes: v.notes,
  };
}

/** 刪除確認：客戶名稱-報價單號，便於與表格列對照 */
function quotationDeleteConfirmLabel(q: ApiQuotation | null): string {
  if (!q) return "";
  const name = (q.customerName ?? "").trim();
  return name ? `${name}-${q.quoteNo}` : q.quoteNo;
}

type Props = {
  org: QuotationPrintOrg;
  headingTitle?: string;
  headingDescription?: string;
};

type FormDialogMode = "create" | "edit" | "view";

export function QuotationWorkspace({ org, headingTitle, headingDescription }: Props) {
  const [rows, setRows] = useState<ApiQuotation[]>([]);
  const [loading, setLoading] = useState(true);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formDialogMode, setFormDialogMode] = useState<FormDialogMode>("create");
  const [selected, setSelected] = useState<ApiQuotation | null>(null);
  const [formKey, setFormKey] = useState("new");
  const [formDefaults, setFormDefaults] = useState<QuotationFormValues>(() => emptyQuotationDefaults());
  const [prefillCustomerQuery, setPrefillCustomerQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [, setSelectedCustomerCache] = useState<CustomerOption | null>(null);
  const [, setLiveForm] = useState<QuotationFormValues | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiQuotation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [convertTarget, setConvertTarget] = useState<ApiQuotation | null>(null);
  const [converting, setConverting] = useState(false);

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printContext, setPrintContext] = useState<{
    row: ApiQuotation;
    form: QuotationFormValues;
    cache: CustomerOption | null;
  } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/quotations", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: ApiQuotation[]; error?: string; hint?: string };
      if (!res.ok) {
        const silentList =
          data.error === "無法讀取報價單" ||
          (typeof data.error === "string" && data.error.includes("無法讀取報價單"));
        if (!silentList) {
          toast.error(data.error ?? "無法載入列表", { description: data.hint });
        }
        setRows(Array.isArray(data.items) ? data.items : []);
        return;
      }
      setRows(Array.isArray(data.items) ? data.items : []);
    } catch {
      toast.error("網路錯誤");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadQuotationDetail = useCallback(async (row: ApiQuotation, mode: FormDialogMode) => {
    setFormDialogMode(mode);
    setSelected(row);
    setFormKey(row.id);
    setFormDialogOpen(true);
    try {
      const res = await fetch(`/api/sales/quotations/${row.id}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { item?: ApiQuotation; error?: string };
      if (!res.ok || !data.item) {
        toast.error(data.error ?? "無法載入報價單");
        setFormDialogOpen(false);
        return;
      }
      const item = data.item;
      const fv = apiToFormValues(item);
      setFormDefaults(fv);
      setLiveForm(fv);
      setPrefillCustomerQuery(item.customerName ?? "");
      if (item.customerId) {
        const cr = await fetch(`/api/sales/customers?id=${encodeURIComponent(item.customerId)}`, {
          credentials: "same-origin",
        });
        const cd = (await cr.json().catch(() => ({}))) as { items?: CustomerOption[] };
        setSelectedCustomerCache(cd.items?.[0] ?? null);
      } else {
        setSelectedCustomerCache(null);
      }
    } catch {
      toast.error("載入失敗");
      setFormDialogOpen(false);
    }
  }, []);

  const openCreate = () => {
    setFormDialogMode("create");
    setSelected(null);
    setFormDefaults(emptyQuotationDefaults());
    setFormKey(`new-${Date.now()}`);
    setPrefillCustomerQuery("");
    setSelectedCustomerCache(null);
    setLiveForm(null);
    setFormDialogOpen(true);
  };

  const openEdit = (row: ApiQuotation) => void loadQuotationDetail(row, "edit");

  const openView = (row: ApiQuotation) => void loadQuotationDetail(row, "view");

  const openDelete = (row: ApiQuotation) => {
    setDeleteTarget(row);
    setDeleteDialogOpen(true);
  };

  const openConvert = (row: ApiQuotation) => {
    setConvertTarget(row);
    setConvertDialogOpen(true);
  };

  const confirmConvert = async () => {
    if (!convertTarget?.id) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/sales/quotations/${convertTarget.id}/convert-contract`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        contract?: { contractNo: string };
      };
      if (!res.ok) {
        toast.error(data.error ?? "轉換失敗", { description: data.hint });
        return;
      }
      const no = data.contract?.contractNo ?? "";
      toast.success(no ? `已建立銷售合同 ${no}` : "已建立銷售合同");
      setConvertDialogOpen(false);
      const convertedId = convertTarget.id;
      setConvertTarget(null);
      if (selected?.id === convertedId) {
        setSelected((s) => (s ? { ...s, status: "Converted" } : null));
        setFormDefaults((prev) => ({ ...prev, status: "Converted" }));
        setLiveForm((prev) => (prev ? { ...prev, status: "Converted" } : null));
      }
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setConverting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales/quotations/${deleteTarget.id}`, { method: "DELETE", credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "刪除失敗");
        return;
      }
      toast.success("已刪除");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      if (selected?.id === deleteTarget.id) {
        setFormDialogOpen(false);
        setSelected(null);
      }
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setDeleting(false);
    }
  };

  const openPrintForRow = async (row: ApiQuotation) => {
    try {
      const res = await fetch(`/api/sales/quotations/${row.id}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { item?: ApiQuotation; error?: string };
      if (!res.ok || !data.item) {
        toast.error(data.error ?? "無法載入報價單");
        return;
      }
      const item = data.item;
      const fv = apiToFormValues(item);
      let cache: CustomerOption | null = null;
      if (item.customerId) {
        const cr = await fetch(`/api/sales/customers?id=${encodeURIComponent(item.customerId)}`, {
          credentials: "same-origin",
        });
        const cd = (await cr.json().catch(() => ({}))) as { items?: CustomerOption[] };
        cache = cd.items?.[0] ?? null;
      }
      setPrintContext({ row: item, form: fv, cache });
      setPrintDialogOpen(true);
    } catch {
      toast.error("載入失敗");
    }
  };

  const onSubmit = async (values: QuotationFormValues) => {
    setSaving(true);
    try {
      const payload = formToApiPayload(values);
      if (selected && formDialogMode !== "create") {
        const res = await fetch(`/api/sales/quotations/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            status: values.status,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; item?: ApiQuotation };
        if (!res.ok) {
          toast.error(data.error ?? "更新失敗");
          return;
        }
        toast.success("已更新");
        if (data.item) {
          const row = data.item as ApiQuotation;
          const fv = apiToFormValues(row);
          setSelected(row);
          setFormDefaults(fv);
          setLiveForm(fv);
          setPrefillCustomerQuery(row.customerName ?? "");
        }
      } else {
        const res = await fetch("/api/sales/quotations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; item?: ApiQuotation };
        if (!res.ok) {
          toast.error(data.error ?? "建立失敗");
          return;
        }
        toast.success("已建立");
        if (data.item) {
          const row = data.item as ApiQuotation;
          const fv = apiToFormValues(row);
          setSelected(row);
          setFormDialogMode("edit");
          setFormKey(row.id);
          setFormDefaults(fv);
          setLiveForm(fv);
          setPrefillCustomerQuery(row.customerName ?? "");
        }
      }
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (status: "Draft" | "Sent" | "Accepted" | "Expired" | "Converted") => {
    if (!selected?.id || formDialogMode === "view") {
      toast.message("請在編輯模式下操作");
      return;
    }
    try {
      const res = await fetch(`/api/sales/quotations/${selected.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "狀態更新失敗");
        return;
      }
      toast.success("狀態已更新");
      setSelected((s) => (s ? { ...s, status } : null));
      setFormDefaults((prev) => ({ ...prev, status }));
      setLiveForm((prev) => (prev ? { ...prev, status } : null));
      await loadList();
    } catch {
      toast.error("網路錯誤");
    }
  };

  const printDialogSnapshot = useMemo(() => {
    if (!printContext) return null;
    return buildPrintSnapshot(printContext.row, printContext.form, printContext.cache);
  }, [printContext]);

  const formDialogTitle =
    formDialogMode === "create" ? "新增報價單" : formDialogMode === "view" ? `查看：${selected?.quoteNo ?? ""}` : `編輯：${selected?.quoteNo ?? ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            {headingTitle ?? "報價單功能"}
          </h1>
          <p className="text-sm text-zinc-500">
            {headingDescription ?? "表格檢視，使用彈窗新增、查看、編輯與刪除"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/sales/contracts">銷售合同</Link>
          </Button>
          <Button type="button" onClick={openCreate}>
            新增報價單
          </Button>
        </div>
      </div>

      <div className="crm-table-shell overflow-hidden">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">報價單號</th>
              <th className="px-4 py-3">客戶</th>
              <th className="px-4 py-3">客戶編號</th>
              <th className="px-4 py-3">報價日</th>
              <th className="px-4 py-3">有效至</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3 text-right">含稅總額</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  載入中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  尚無報價單資料，請點「新增報價單」
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.quoteNo}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.customerName}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{r.customerCode ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{ymd(r.quoteDate)}</td>
                  <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{r.validUntil ? ymd(r.validUntil) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {quotationStatusLabelHk(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                    {fmtMoney(r.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => void openView(r)}>
                        查看
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => void openEdit(r)}>
                        編輯
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => void openPrintForRow(r)}>
                        下載
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        disabled={r.status === "Converted"}
                        onClick={() => openConvert(r)}
                        title={r.status === "Converted" ? "已轉成銷售合同" : "一鍵建立銷售合同並將狀態設為已轉合同"}
                      >
                        轉成合同
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => openDelete(r)}
                      >
                        刪除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-h-[min(90vh,880px)] w-[min(96vw,56rem)] max-w-none gap-0 overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <DialogTitle>{formDialogTitle}</DialogTitle>
            <DialogDescription className="sr-only">報價單表單</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-4">
            {formDialogMode === "edit" && selected ? (
              <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-700">
                <span className="self-center text-xs text-zinc-500">狀態：</span>
                {(["Sent", "Accepted", "Expired", "Converted"] as const).map((s) => (
                  <Button key={s} type="button" size="sm" variant="outline" onClick={() => void updateStatus(s)}>
                    {quotationStatusLabelHk(s)}
                  </Button>
                ))}
              </div>
            ) : null}
            <QuotationEditor
              formId="quotation-form-dialog"
              formKey={formKey}
              defaultValues={formDefaults}
              readOnly={formDialogMode === "view"}
              prefillCustomerQuery={prefillCustomerQuery}
              onValuesChange={setLiveForm}
              onCustomerResolved={setSelectedCustomerCache}
              onSubmit={formDialogMode === "view" ? undefined : onSubmit}
              saving={saving}
              submitLabel={selected && formDialogMode !== "create" ? "更新報價單" : "建立報價單"}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除報價單「{quotationDeleteConfirmLabel(deleteTarget)}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              取消
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? "刪除中…" : "刪除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>轉成銷售合同</DialogTitle>
            <DialogDescription>
              將報價單「{quotationDeleteConfirmLabel(convertTarget)}」複製為一筆銷售合同（合同編號另編），並把報價單狀態設為「已轉合同」。
              每份報價單僅能轉換一次。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={converting}>
              取消
            </Button>
            <Button type="button" onClick={() => void confirmConvert()} disabled={converting}>
              {converting ? "建立中…" : "確認轉換"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-h-[min(92vh,900px)] w-[min(96vw,56rem)] max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>下載 PDF</DialogTitle>
            <DialogDescription>以下為 A4 版面預覽；點「下載 PDF」會開啟列印視窗，請選擇「另存為 PDF」。</DialogDescription>
          </DialogHeader>
          {printDialogSnapshot ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <QuotationPrintView org={org} {...printDialogSnapshot} />
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
