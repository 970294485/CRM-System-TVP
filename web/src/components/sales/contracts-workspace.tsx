"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ContractPrintView, type ContractPrintViewProps } from "@/components/sales/contract-print-view";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  QuotationEditor,
  type CustomerOption,
  type QuotationFormValues,
  emptyQuotationDefaults,
} from "@/components/sales/quotation-editor";
import { lineTotalFromInputs, totalsFromLines } from "@/lib/sales/quotation-math";
import type { SalesContractDetail } from "@/lib/sales/load-sales-contract";

type ApiContract = {
  id: string;
  contractNo: string;
  sourceQuoteNo: string | null;
  quotationId: string | null;
  customerId: string | null;
  customerName: string;
  contractDate: string;
  totalAmount: string;
  prepaymentAmount: string | null;
  prepaymentNotes: string | null;
  status: string;
  createdAt: string;
  ownerUserId: string | null;
  ownerName: string | null;
  commissionRatePercent: string | null;
  proformaInvoiceNo: string | null;
};

function ymd(v: string | Date | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  return v.toISOString().slice(0, 10);
}

function fmtMoney(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function numFromApi(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

const CONTRACT_STATUS_HK: Record<string, string> = {
  Active: "生效中",
  Completed: "已完成",
  Cancelled: "已取消",
};

function contractStatusLabel(s: string): string {
  return CONTRACT_STATUS_HK[s] ?? s;
}

function addDays(ymdStr: string, d: number): string {
  const dt = new Date(`${ymdStr}T12:00:00`);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
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

function contractDetailToForm(row: SalesContractDetail): QuotationFormValues {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items = rawItems.map(normalizeItemFromApi).filter((x): x is NonNullable<typeof x> => x != null);
  const base = emptyQuotationDefaults();
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

  const qd = ymd(row.contractDate) || base.quote_date;
  const st = ["Active", "Completed", "Cancelled"].includes(row.status) ? row.status : "Active";

  return {
    customer_id: row.customerId ?? "",
    quote_date: qd,
    valid_until: ymd(row.validUntil) || addDays(qd, 30),
    tax_rate: row.taxRate != null && row.taxRate !== "" ? Number(row.taxRate) : 5,
    notes: row.notes ?? "",
    status: st,
    items: safeItems,
  };
}

function buildContractPrintSnapshot(
  row: SalesContractDetail,
  customerCache: CustomerOption | null
): Omit<ContractPrintViewProps, "org"> {
  const v = contractDetailToForm(row);
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
  const prepayN = row.prepaymentAmount != null && row.prepaymentAmount !== "" ? Number(row.prepaymentAmount) : NaN;
  const prepaymentAmount = Number.isFinite(prepayN) && prepayN > 0 ? prepayN : null;
  const custName = customerCache?.name ?? row.customerName ?? "—";

  return {
    contractNo: row.contractNo,
    contractDate: v.quote_date,
    validUntil: v.valid_until,
    sourceQuoteNo: row.sourceQuoteNo,
    statusLabel: contractStatusLabel(row.status),
    customerName: custName,
    customerCode: customerCache?.customerCode ?? null,
    contactName: customerCache?.contactName,
    customerPhone: customerCache?.phone ?? row.customerPhone,
    customerEmail: customerCache?.email ?? row.customerEmail,
    customerAddress: customerCache?.address,
    lines,
    subtotal,
    taxRate: v.tax_rate,
    taxAmount: tax_amount,
    totalAmount: total_amount,
    prepaymentAmount,
    prepaymentNotes: row.prepaymentNotes,
    proformaInvoiceNo: row.proformaInvoiceNo,
    notes: v.notes,
  };
}

function formToContractFullPayload(
  values: QuotationFormValues,
  prepayAmt: number,
  prepayNotes: string | null,
  finance: { ownerUserId: string | null; commissionRatePercent: number | null }
) {
  return {
    customer_id: values.customer_id,
    contract_date: values.quote_date,
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
    prepayment_amount: prepayAmt,
    prepayment_notes: prepayNotes?.trim() ? prepayNotes.trim() : null,
    owner_user_id: finance.ownerUserId,
    commission_rate_percent: finance.commissionRatePercent,
  };
}

function contractDeleteLabel(c: ApiContract | null): string {
  if (!c) return "";
  const name = (c.customerName ?? "").trim();
  return name ? `${name}-${c.contractNo}` : c.contractNo;
}

type WorkspaceProps = { org: QuotationPrintOrg };

export function ContractsWorkspace({ org }: WorkspaceProps) {
  const [rows, setRows] = useState<ApiContract[]>([]);
  const [loading, setLoading] = useState(true);

  const [prepayDialogOpen, setPrepayDialogOpen] = useState(false);
  const [prepayTarget, setPrepayTarget] = useState<ApiContract | null>(null);
  const [prepayAmount, setPrepayAmount] = useState("");
  const [prepayNotes, setPrepayNotes] = useState("");
  const [savingPrepay, setSavingPrepay] = useState(false);

  const [convertingId, setConvertingId] = useState<string | null>(null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editContractNo, setEditContractNo] = useState("");
  const [editFormKey, setEditFormKey] = useState("");
  const [editFormDefaults, setEditFormDefaults] = useState<QuotationFormValues>(() => emptyQuotationDefaults());
  const [editPrefillCustomerQuery, setEditPrefillCustomerQuery] = useState("");
  const [editPrepayAmount, setEditPrepayAmount] = useState("");
  const [editPrepayNotes, setEditPrepayNotes] = useState("");
  const [editOwnerUserId, setEditOwnerUserId] = useState<string>("");
  const [editCommissionRate, setEditCommissionRate] = useState("");
  const [userPickList, setUserPickList] = useState<{ id: string; name: string; email: string }[]>([]);
  /** 若業務帳號已停用未出現在列表，仍保留一筆供 Select 顯示 */
  const [editOwnerFallback, setEditOwnerFallback] = useState<{ id: string; name: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiContract | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printSnapshot, setPrintSnapshot] = useState<Omit<ContractPrintViewProps, "org"> | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales/contracts", { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: ApiContract[]; error?: string };
      if (!res.ok) {
        setRows([]);
        if (data.error) toast.error(data.error);
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

  useEffect(() => {
    if (!editDialogOpen) return;
    void (async () => {
      try {
        const res = await fetch("/api/company-documents/users?limit=200", { credentials: "same-origin" });
        const data = (await res.json().catch(() => ({}))) as { items?: { id: string; name: string; email: string }[] };
        setUserPickList(Array.isArray(data.items) ? data.items : []);
      } catch {
        setUserPickList([]);
      }
    })();
  }, [editDialogOpen]);

  const openPrepay = (row: ApiContract) => {
    setPrepayTarget(row);
    setPrepayAmount(numFromApi(row.prepaymentAmount));
    setPrepayNotes(row.prepaymentNotes ?? "");
    setPrepayDialogOpen(true);
  };

  const savePrepay = async () => {
    if (!prepayTarget?.id) return;
    const amt = prepayAmount.trim() === "" ? 0 : Number(prepayAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("預收款須為非負數");
      return;
    }
    setSavingPrepay(true);
    try {
      const res = await fetch(`/api/sales/contracts/${prepayTarget.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prepayment_amount: amt,
          prepayment_notes: prepayNotes.trim() ? prepayNotes.trim() : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        toast.error(data.error ?? "儲存失敗", { description: data.hint });
        return;
      }
      toast.success("已更新預收款");
      setPrepayDialogOpen(false);
      setPrepayTarget(null);
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setSavingPrepay(false);
    }
  };

  const convertProforma = async (row: ApiContract) => {
    setConvertingId(row.id);
    try {
      const res = await fetch(`/api/sales/contracts/${row.id}/convert-proforma`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hint?: string;
        proforma?: { invoiceNo: string };
      };
      if (!res.ok) {
        toast.error(data.error ?? "開立失敗", { description: data.hint });
        return;
      }
      const no = data.proforma?.invoiceNo ?? "";
      toast.success(no ? `已開立預收發票 ${no}` : "已開立預收發票");
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setConvertingId(null);
    }
  };

  const openDownloadForRow = async (row: ApiContract) => {
    try {
      const res = await fetch(`/api/sales/contracts/${row.id}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { item?: SalesContractDetail; error?: string };
      if (!res.ok || !data.item) {
        toast.error(data.error ?? "無法載入合同");
        return;
      }
      const item = data.item;
      let cache: CustomerOption | null = null;
      if (item.customerId) {
        const cr = await fetch(`/api/sales/customers?id=${encodeURIComponent(item.customerId)}`, {
          credentials: "same-origin",
        });
        const cd = (await cr.json().catch(() => ({}))) as { items?: CustomerOption[] };
        cache = cd.items?.[0] ?? null;
      }
      setPrintSnapshot(buildContractPrintSnapshot(item, cache));
      setPrintDialogOpen(true);
    } catch {
      toast.error("載入失敗");
    }
  };

  const openEdit = async (row: ApiContract) => {
    try {
      const res = await fetch(`/api/sales/contracts/${row.id}`, { credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { item?: SalesContractDetail; error?: string };
      if (!res.ok || !data.item) {
        toast.error(data.error ?? "無法載入合同");
        return;
      }
      const item = data.item;
      setEditTargetId(item.id);
      setEditContractNo(item.contractNo);
      setEditFormDefaults(contractDetailToForm(item));
      setEditFormKey(item.id);
      setEditPrepayAmount(numFromApi(item.prepaymentAmount));
      setEditPrepayNotes(item.prepaymentNotes ?? "");
      setEditOwnerUserId(item.ownerUserId ?? "");
      setEditCommissionRate(numFromApi(item.commissionRatePercent));
      setEditOwnerFallback(
        item.ownerUserId
          ? { id: item.ownerUserId, name: (item.ownerName ?? "").trim() || "（未載入姓名）" }
          : null
      );
      setEditPrefillCustomerQuery(item.customerName ?? "");
      setEditDialogOpen(true);
    } catch {
      toast.error("載入失敗");
    }
  };

  const saveContractEdit = async (values: QuotationFormValues) => {
    if (!editTargetId) return;
    const amt = editPrepayAmount.trim() === "" ? 0 : Number(editPrepayAmount);
    if (!Number.isFinite(amt) || amt < 0) {
      toast.error("預收款須為非負數");
      return;
    }
    const ownerUserId = editOwnerUserId.trim() === "" ? null : editOwnerUserId.trim();
    let commissionRatePercent: number | null = null;
    if (editCommissionRate.trim() !== "") {
      const cr = Number(editCommissionRate);
      if (!Number.isFinite(cr) || cr < 0 || cr > 100) {
        toast.error("佣金比例須為 0–100");
        return;
      }
      commissionRatePercent = cr;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/sales/contracts/${editTargetId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          formToContractFullPayload(values, amt, editPrepayNotes.trim() ? editPrepayNotes.trim() : null, {
            ownerUserId,
            commissionRatePercent,
          })
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hint?: string };
      if (!res.ok) {
        toast.error(data.error ?? "儲存失敗", { description: data.hint });
        return;
      }
      toast.success("合同已更新");
      setEditDialogOpen(false);
      setEditTargetId(null);
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setEditSaving(false);
    }
  };

  const openDelete = (row: ApiContract) => {
    setDeleteTarget(row);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget?.id) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales/contracts/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "刪除失敗");
        return;
      }
      toast.success("已刪除");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      if (editTargetId === deleteTarget.id) {
        setEditDialogOpen(false);
        setEditTargetId(null);
      }
      await loadList();
    } catch {
      toast.error("網路錯誤");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">銷售合同</h1>
          <p className="text-sm text-zinc-500">
            由報價單轉換；可設定預收款（含稅）並一鍵開立預收發票（每份合同至多一張）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/sales/proforma-invoices">預收發票</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/sales/finance-commission">對應財務和佣金功能</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/sales/quotations">報價單功能</Link>
          </Button>
        </div>
      </div>

      <div className="crm-table-shell overflow-hidden">
        <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
              <th className="px-4 py-3">合同編號</th>
              <th className="px-4 py-3">客戶</th>
              <th className="px-4 py-3">來源報價單</th>
              <th className="px-4 py-3">合同日</th>
              <th className="px-4 py-3">狀態</th>
              <th className="px-4 py-3 text-right">合同總額</th>
              <th className="px-4 py-3 text-right">預收款（含稅）</th>
              <th className="px-4 py-3">預收發票</th>
              <th className="px-4 py-3">業務</th>
              <th className="px-4 py-3 text-right">佣金%</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">
                  載入中…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-zinc-500">
                  尚無銷售合同。請至報價單列表點「轉成合同」建立。
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const prepayN = Number(r.prepaymentAmount);
                const hasPrepay = Number.isFinite(prepayN) && prepayN > 0;
                const canConvert = r.status === "Active" && hasPrepay && !r.proformaInvoiceNo;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800/80 dark:hover:bg-zinc-900/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-700 dark:text-zinc-300">{r.contractNo}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.customerName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {r.sourceQuoteNo ?? (r.quotationId ? "（報價單）" : "—")}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-zinc-700 dark:text-zinc-300">{ymd(r.contractDate) || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {contractStatusLabel(r.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-50">
                      {fmtMoney(r.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {fmtMoney(r.prepaymentAmount)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                      {r.proformaInvoiceNo ?? "—"}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300">
                      {r.ownerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {r.commissionRatePercent != null && r.commissionRatePercent !== ""
                        ? fmtMoney(r.commissionRatePercent)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => void openEdit(r)}
                        >
                          編輯
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => void openDownloadForRow(r)}
                        >
                          下載
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
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          disabled={r.status !== "Active"}
                          onClick={() => openPrepay(r)}
                        >
                          預收款
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          disabled={!canConvert || convertingId === r.id}
                          title={
                            r.proformaInvoiceNo
                              ? "已開立預收發票"
                              : !hasPrepay
                                ? "請先設定預收款"
                                : r.status !== "Active"
                                  ? "僅生效中合同可開立"
                                  : "一鍵開立預收發票"
                          }
                          onClick={() => void convertProforma(r)}
                        >
                          {convertingId === r.id ? "開立中…" : "轉預收發票"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[min(90vh,880px)] w-[min(96vw,56rem)] max-w-none gap-0 overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <DialogTitle>編輯銷售合同「{editContractNo}」</DialogTitle>
            <DialogDescription className="sr-only">修改合同主檔、明細與預收款</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <QuotationEditor
              formId="contract-edit-form"
              formKey={editFormKey}
              defaultValues={editFormDefaults}
              documentKind="contract"
              prefillCustomerQuery={editPrefillCustomerQuery}
              onSubmit={async (v) => {
                await saveContractEdit(v);
              }}
              saving={editSaving}
              submitLabel="儲存變更"
            />
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-3 text-xs font-medium text-zinc-500">業務與佣金（預收款確認後自動計提）</p>
              <div className="mb-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-owner-user">業務負責人</Label>
                  <Select
                    value={editOwnerUserId || "__none__"}
                    onValueChange={(v) => setEditOwnerUserId(v === "__none__" ? "" : v)}
                    disabled={editSaving}
                  >
                    <SelectTrigger id="edit-owner-user" className="w-full">
                      <SelectValue placeholder="選擇內部帳號" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— 未指定 —</SelectItem>
                      {editOwnerFallback && !userPickList.some((u) => u.id === editOwnerFallback.id) ? (
                        <SelectItem value={editOwnerFallback.id}>{editOwnerFallback.name}</SelectItem>
                      ) : null}
                      {userPickList.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-commission-rate">佣金比例（%，留空表示不計提）</Label>
                  <Input
                    id="edit-commission-rate"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={editCommissionRate}
                    onChange={(e) => setEditCommissionRate(e.target.value)}
                    disabled={editSaving}
                    placeholder="例如：2.5"
                  />
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="mb-3 text-xs font-medium text-zinc-500">預收款（含稅，與預收發票連動）</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-prepay-amt">預收款金額</Label>
                  <Input
                    id="edit-prepay-amt"
                    type="number"
                    step="0.01"
                    min={0}
                    value={editPrepayAmount}
                    onChange={(e) => setEditPrepayAmount(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="edit-prepay-notes">預收款備註</Label>
                  <Textarea
                    id="edit-prepay-notes"
                    rows={2}
                    value={editPrepayNotes}
                    onChange={(e) => setEditPrepayNotes(e.target.value)}
                    disabled={editSaving}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除銷售合同「{contractDeleteLabel(deleteTarget)}」嗎？若曾開立預收發票，將一併刪除。此操作無法復原。
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

      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-h-[min(92vh,900px)] w-[min(96vw,56rem)] max-w-none overflow-y-auto">
          <DialogHeader>
            <DialogTitle>下載 PDF</DialogTitle>
            <DialogDescription>以下為 A4 版面預覽；點「下載 PDF」會開啟列印視窗，請選擇「另存為 PDF」。</DialogDescription>
          </DialogHeader>
          {printSnapshot ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <ContractPrintView org={org} {...printSnapshot} />
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

      <Dialog open={prepayDialogOpen} onOpenChange={setPrepayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>預收款設定</DialogTitle>
            <DialogDescription>
              合同「{prepayTarget?.contractNo ?? ""}」：預收款請填含稅金額；開立預收發票時會依合同稅率拆成未稅與稅額。可填 0 表示尚未約定。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="prepay-amt">預收款（含稅）</Label>
              <Input
                id="prepay-amt"
                type="number"
                step="0.01"
                min={0}
                value={prepayAmount}
                onChange={(e) => setPrepayAmount(e.target.value)}
                disabled={savingPrepay}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prepay-notes">備註（可選）</Label>
              <Textarea
                id="prepay-notes"
                rows={3}
                value={prepayNotes}
                onChange={(e) => setPrepayNotes(e.target.value)}
                disabled={savingPrepay}
                placeholder="例如：訂金比例、收款期程"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setPrepayDialogOpen(false)} disabled={savingPrepay}>
              取消
            </Button>
            <Button type="button" onClick={() => void savePrepay()} disabled={savingPrepay}>
              {savingPrepay ? "儲存中…" : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
