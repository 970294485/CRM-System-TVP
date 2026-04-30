"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TabKey = "ap" | "ar";

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
  customerId?: string | null;
  customerName: string;
  /** 由銷售合同左連接預收發票（一合同至多一張）；無開立時為 null */
  proformaInvoiceNo: string | null;
};

type ApApprovalStatus = {
  id: string;
  policyId: string | null;
  policyName: string | null;
  totalSteps: number;
  completedSteps: number;
  steps: { index: number; label: string; done: boolean; roleSlugs: string[] }[];
  canSignNextStep: boolean;
  canFinalizeConfirm: boolean;
};

type PoOption = {
  id: string;
  poNo: string;
  customerName: string | null;
  totalAmount: string;
  paidAmount: string;
};
type ContractOption = {
  id: string;
  contractNo: string;
  customerName: string;
  proformaInvoiceNo: string | null;
};

function fmtMoney(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-HK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

const AP_STATUS: Record<string, string> = { Draft: "草稿", Confirmed: "已確認付款" };
const AR_STATUS: Record<string, string> = { Draft: "草稿", Received: "已確認收款" };
const PO_PAY: Record<string, string> = { Unpaid: "未付", Partial: "部分付款", Paid: "已付清" };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function PaymentRequestsAdvancesWorkspace({ editable }: { editable: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledPoFromUrl = useRef<string | null>(null);

  const [tab, setTab] = useState<TabKey>("ap");
  const [apItems, setApItems] = useState<ApRow[]>([]);
  const [arItems, setArItems] = useState<ArRow[]>([]);
  const [poOptions, setPoOptions] = useState<PoOption[]>([]);
  const [contractOptions, setContractOptions] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [apDialogOpen, setApDialogOpen] = useState(false);
  const [arDialogOpen, setArDialogOpen] = useState(false);
  const [apSubmitting, setApSubmitting] = useState(false);
  const [arSubmitting, setArSubmitting] = useState(false);
  const [apApprovalById, setApApprovalById] = useState<Record<string, ApApprovalStatus>>({});

  const [apForm, setApForm] = useState({
    documentNo: "",
    purchaseOrderId: "",
    amount: "",
    requestDate: todayYmd(),
    notes: "",
  });
  const [arForm, setArForm] = useState({
    documentNo: "",
    salesContractId: "",
    amount: "",
    receiptDate: todayYmd(),
    notes: "",
  });

  const loadAp = useCallback(async () => {
    const res = await fetch("/api/finance/ap-payment-requests", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as {
      items?: ApRow[];
      error?: string;
      warning?: string;
      detail?: string;
    };
    if (!res.ok) {
      const base = data.error ?? "讀取應付請款單失敗";
      throw new Error(data.detail ? `${base} — ${data.detail}` : base);
    }
    if (data.warning) {
      toast.warning(data.detail ? `${data.warning}（詳情見主控台 Network 回應 detail）` : data.warning);
      if (data.detail) console.warn("[ap-payment-requests]", data.detail);
    }
    const items = data.items ?? [];
    const draftIds = items.filter((it) => it.status === "Draft").map((it) => it.id);
    let nextApproval: Record<string, ApApprovalStatus> = {};
    if (draftIds.length) {
      try {
        const stRes = await fetch("/api/finance/ap-payment-requests/approval-status", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: draftIds }),
        });
        const stJson = (await stRes.json().catch(() => ({}))) as {
          items?: ApApprovalStatus[];
          warning?: string;
          error?: string;
        };
        if (stJson.warning) toast.warning(stJson.warning);
        if (!stRes.ok) {
          console.warn(stJson.error ?? "approval-status");
          for (const id of draftIds) {
            nextApproval[id] = {
              id,
              policyId: null,
              policyName: null,
              totalSteps: 0,
              completedSteps: 0,
              steps: [],
              canSignNextStep: false,
              canFinalizeConfirm: true,
            };
          }
        } else {
          for (const row of stJson.items ?? []) {
            nextApproval[row.id] = row;
          }
        }
      } catch {
        nextApproval = {};
      }
    }
    setApItems(items);
    setApApprovalById(nextApproval);
  }, []);

  const loadAr = useCallback(async () => {
    const res = await fetch("/api/finance/ar-advance-receipts", { credentials: "same-origin" });
    const data = (await res.json().catch(() => ({}))) as { items?: ArRow[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "讀取預收款單失敗");
    setArItems(data.items ?? []);
  }, []);

  const loadRefs = useCallback(async () => {
    const [poRes, ctRes] = await Promise.all([
      fetch("/api/purchase-orders", { credentials: "same-origin" }),
      fetch("/api/sales/contracts", { credentials: "same-origin" }),
    ]);
    const poData = (await poRes.json().catch(() => ({}))) as {
      items?: Record<string, unknown>[];
    };
    const ctData = (await ctRes.json().catch(() => ({}))) as {
      items?: Record<string, unknown>[];
    };
    if (poRes.ok && Array.isArray(poData.items)) {
      setPoOptions(
        poData.items.map((r) => ({
          id: String(r.id),
          poNo: String(r.po_no ?? r.poNo ?? ""),
          customerName: (r.customer_name ?? r.customerName ?? null) as string | null,
          totalAmount: String(r.total_amount ?? r.totalAmount ?? "0"),
          paidAmount: String(r.paid_amount ?? r.paidAmount ?? "0"),
        }))
      );
    }
    if (ctRes.ok && Array.isArray(ctData.items)) {
      setContractOptions(
        ctData.items.map((r) => {
          const pfn = r.proformaInvoiceNo ?? r.proforma_invoice_no;
          return {
            id: String(r.id),
            contractNo: String(r.contractNo ?? r.contract_no ?? ""),
            customerName: String(r.customerName ?? r.customer_name ?? ""),
            proformaInvoiceNo:
              pfn != null && String(pfn).trim() !== "" ? String(pfn) : null,
          };
        })
      );
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadAp(), loadAr(), loadRefs()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, [loadAp, loadAr, loadRefs]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "ar") setTab("ar");
    else if (t === "ap") setTab("ap");
  }, [searchParams]);

  useEffect(() => {
    if (loading) return;
    const raw = searchParams.get("poId")?.trim() ?? "";
    if (!raw) {
      handledPoFromUrl.current = null;
      return;
    }
    if (!UUID_RE.test(raw)) return;
    if (handledPoFromUrl.current === raw) return;
    handledPoFromUrl.current = raw;

    const po = poOptions.find((p) => p.id === raw);
    let amountDefault = "";
    if (po) {
      const total = Number(po.totalAmount);
      const paid = Number(po.paidAmount);
      const rem = total - paid;
      if (Number.isFinite(rem) && rem > 0) amountDefault = rem.toFixed(2);
    }

    setTab("ap");
    setApForm({
      documentNo: "",
      purchaseOrderId: raw,
      amount: amountDefault,
      requestDate: todayYmd(),
      notes: "",
    });
    setApDialogOpen(true);
    router.replace("/dashboard/finance/payment-requests-advances", { scroll: false });
  }, [loading, searchParams, router, poOptions]);

  async function submitAp(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const amt = Number(apForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("請輸入有效金額");
      return;
    }
    if (!apForm.purchaseOrderId) {
      toast.error("請選擇採購單");
      return;
    }
    setApSubmitting(true);
    try {
      const res = await fetch("/api/finance/ap-payment-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentNo: apForm.documentNo.trim() || undefined,
          purchaseOrderId: apForm.purchaseOrderId,
          amount: amt,
          requestDate: apForm.requestDate,
          notes: apForm.notes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "建立失敗");
        return;
      }
      toast.success("已建立應付請款單（草稿）");
      setApDialogOpen(false);
      setApForm({
        documentNo: "",
        purchaseOrderId: "",
        amount: "",
        requestDate: todayYmd(),
        notes: "",
      });
      await loadAp();
    } finally {
      setApSubmitting(false);
    }
  }

  async function submitAr(e: React.FormEvent) {
    e.preventDefault();
    if (!editable) return;
    const amt = Number(arForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("請輸入有效金額");
      return;
    }
    if (!arForm.salesContractId) {
      toast.error("請選擇銷售合同");
      return;
    }
    setArSubmitting(true);
    try {
      const res = await fetch("/api/finance/ar-advance-receipts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentNo: arForm.documentNo.trim() || undefined,
          salesContractId: arForm.salesContractId,
          amount: amt,
          receiptDate: arForm.receiptDate,
          notes: arForm.notes.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "建立失敗");
        return;
      }
      toast.success("已建立預收款單（草稿）");
      setArDialogOpen(false);
      setArForm({
        documentNo: "",
        salesContractId: "",
        amount: "",
        receiptDate: todayYmd(),
        notes: "",
      });
      await loadAr();
    } finally {
      setArSubmitting(false);
    }
  }

  async function approveApStep(id: string) {
    if (!editable) return;
    const res = await fetch(`/api/finance/ap-payment-requests/${id}/approval-step`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "核准失敗");
      return;
    }
    toast.success("已記錄本階審批");
    await loadAp();
  }

  async function confirmAp(id: string) {
    if (!editable) return;
    const st = apApprovalById[id];
    if (st && !st.canFinalizeConfirm) {
      toast.error("須完成多層審批後方可確認付款（或請超級管理員操作）");
      return;
    }
    const res = await fetch(`/api/finance/ap-payment-requests/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      approvalRequired?: number;
      approvalCompleted?: number;
    };
    if (!res.ok) {
      toast.error(data.error ?? "確認失敗");
      return;
    }
    toast.success("已確認付款，採購單付款狀態已更新");
    await loadAp();
  }

  async function confirmAr(id: string) {
    if (!editable) return;
    const res = await fetch(`/api/finance/ar-advance-receipts/${id}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_receive" }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "確認失敗");
      return;
    }
    toast.success("已確認收款");
    await loadAr();
  }

  async function deleteAp(id: string) {
    if (!editable) return;
    if (!window.confirm("確定刪除此草稿請款單？")) return;
    const res = await fetch(`/api/finance/ap-payment-requests/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "刪除失敗");
      return;
    }
    toast.success("已刪除");
    await loadAp();
  }

  async function deleteAr(id: string) {
    if (!editable) return;
    if (!window.confirm("確定刪除此草稿預收款單？")) return;
    const res = await fetch(`/api/finance/ar-advance-receipts/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "刪除失敗");
      return;
    }
    toast.success("已刪除");
    await loadAr();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-700">
        <button
          type="button"
          onClick={() => setTab("ap")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "ap"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          應付請款單（採購）
        </button>
        <button
          type="button"
          onClick={() => setTab("ar")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === "ar"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          預收款單（銷售合同）
        </button>
        <Button type="button" variant="outline" size="sm" className="ml-auto" onClick={() => void refresh()}>
          重新載入
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">載入中…</p>
      ) : tab === "ap" ? (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" disabled={!editable} onClick={() => setApDialogOpen(true)}>
              新增應付請款單
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2 font-medium">請款單號</th>
                  <th className="px-3 py-2 font-medium">採購單</th>
                  <th className="px-3 py-2 font-medium">供應商／對象</th>
                  <th className="px-3 py-2 text-right font-medium">請款金額</th>
                  <th className="px-3 py-2 font-medium">申請日</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 font-medium min-w-[140px]">多層審批</th>
                  <th className="px-3 py-2 font-medium">採購單付款</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {apItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                      尚無請款單。請先建立草稿，於外部付款完成後再按「確認付款」以更新採購單。
                    </td>
                  </tr>
                ) : (
                  apItems.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs">{r.documentNo}</td>
                      <td className="px-3 py-2">{r.poNo}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {r.supplierName ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600">{r.requestDate}</td>
                      <td className="px-3 py-2">{AP_STATUS[r.status] ?? r.status}</td>
                      <td className="px-3 py-2 align-top text-xs">
                        {r.status === "Draft" ? (
                          (() => {
                            const ap = apApprovalById[r.id];
                            if (!ap || ap.totalSteps === 0) {
                              return <span className="text-zinc-400">未套用策略</span>;
                            }
                            return (
                              <div className="space-y-1">
                                <span className="tabular-nums text-zinc-800 dark:text-zinc-100">
                                  {ap.completedSteps}/{ap.totalSteps}
                                </span>
                                <div className="flex flex-wrap gap-0.5">
                                  {ap.steps.map((s) => (
                                    <span
                                      key={s.index}
                                      className={
                                        s.done
                                          ? "rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200"
                                          : "rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                                      }
                                      title={s.roleSlugs.join(", ")}
                                    >
                                      {s.label}
                                    </span>
                                  ))}
                                </div>
                                {ap.policyName ? (
                                  <p className="line-clamp-2 text-[10px] text-zinc-500">{ap.policyName}</p>
                                ) : null}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {PO_PAY[r.poPaymentStatus] ?? r.poPaymentStatus}（已付 {fmtMoney(r.poPaid)} /{" "}
                          {fmtMoney(r.poTotal)}）
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.status === "Draft" && editable ? (
                            <>
                              {(() => {
                                const apSt = apApprovalById[r.id];
                                const showApprove = apSt && apSt.totalSteps > 0 && apSt.completedSteps < apSt.totalSteps;
                                return showApprove ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={!apSt?.canSignNextStep}
                                    onClick={() => void approveApStep(r.id)}
                                    title={!apSt?.canSignNextStep ? "目前登入角色不可簽次一階（超級管理員除外）" : undefined}
                                  >
                                    核准當前階段
                                  </Button>
                                ) : null;
                              })()}
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={(() => {
                                  const apSt = apApprovalById[r.id];
                                  if (!apSt) return false;
                                  return !apSt.canFinalizeConfirm;
                                })()}
                                onClick={() => void confirmAp(r.id)}
                              >
                                確認付款
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => void deleteAp(r.id)}>
                                刪除
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" disabled={!editable} onClick={() => setArDialogOpen(true)}>
              新增預收款單
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                <tr>
                  <th className="px-3 py-2 font-medium">預收款單號</th>
                  <th className="px-3 py-2 font-medium">合同編號</th>
                  <th className="px-3 py-2 font-medium">預收發票號</th>
                  <th className="px-3 py-2 font-medium">客戶</th>
                  <th className="px-3 py-2 text-right font-medium">金額</th>
                  <th className="px-3 py-2 font-medium">收款日</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {arItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-zinc-500">
                      尚無預收款單。款項入帳後可在此登記，供後續與合同／發票匹配。
                    </td>
                  </tr>
                ) : (
                  arItems.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs">{r.documentNo}</td>
                      <td className="px-3 py-2">{r.contractNo}</td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {r.proformaInvoiceNo ?? "—"}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-zinc-600 dark:text-zinc-400">
                        {r.customerName}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600">{r.receiptDate}</td>
                      <td className="px-3 py-2">{AR_STATUS[r.status] ?? r.status}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.status === "Draft" && editable ? (
                            <>
                              <Button type="button" size="sm" variant="secondary" onClick={() => void confirmAr(r.id)}>
                                確認收款
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => void deleteAr(r.id)}>
                                刪除
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={apDialogOpen} onOpenChange={setApDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={submitAp}>
            <DialogHeader>
              <DialogTitle>新增應付請款單</DialogTitle>
              <DialogDescription>
                必須掛鉤採購單。單號可留空由系統產生。確認付款後會累加採購單已付金額並更新付款狀態。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ap-doc-no">文件編號（選填）</Label>
                <Input
                  id="ap-doc-no"
                  value={apForm.documentNo}
                  onChange={(e) => setApForm((s) => ({ ...s, documentNo: e.target.value }))}
                  placeholder="留空則自動產生"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ap-po">採購單 *</Label>
                <select
                  id="ap-po"
                  required
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={apForm.purchaseOrderId}
                  onChange={(e) => setApForm((s) => ({ ...s, purchaseOrderId: e.target.value }))}
                >
                  <option value="">— 選擇 —</option>
                  {poOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.poNo}
                      {p.customerName ? ` · 供應商 ${p.customerName}` : ""}（{fmtMoney(p.totalAmount)}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ap-amt">請款金額 *</Label>
                <Input
                  id="ap-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={apForm.amount}
                  onChange={(e) => setApForm((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ap-date">請款日期 *</Label>
                <Input
                  id="ap-date"
                  type="date"
                  required
                  value={apForm.requestDate}
                  onChange={(e) => setApForm((s) => ({ ...s, requestDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ap-notes">備註</Label>
                <Textarea
                  id="ap-notes"
                  rows={2}
                  value={apForm.notes}
                  onChange={(e) => setApForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={apSubmitting || !editable}>
                {apSubmitting ? "送出中…" : "建立草稿"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={arDialogOpen} onOpenChange={setArDialogOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={submitAr}>
            <DialogHeader>
              <DialogTitle>新增預收款單</DialogTitle>
              <DialogDescription>
                必須掛鉤銷售合同。確認收款後單據結案，後續可與「合同與發票預收款匹配」流程串接。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="ar-doc-no">文件編號（選填）</Label>
                <Input
                  id="ar-doc-no"
                  value={arForm.documentNo}
                  onChange={(e) => setArForm((s) => ({ ...s, documentNo: e.target.value }))}
                  placeholder="留空則自動產生"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ar-ct">銷售合同 *</Label>
                <select
                  id="ar-ct"
                  required
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={arForm.salesContractId}
                  onChange={(e) => setArForm((s) => ({ ...s, salesContractId: e.target.value }))}
                >
                  <option value="">— 選擇 —</option>
                  {contractOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.contractNo} · {c.customerName}
                      {c.proformaInvoiceNo ? ` · 預收發票 ${c.proformaInvoiceNo}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ar-amt">預收金額 *</Label>
                <Input
                  id="ar-amt"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={arForm.amount}
                  onChange={(e) => setArForm((s) => ({ ...s, amount: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ar-date">收款日期 *</Label>
                <Input
                  id="ar-date"
                  type="date"
                  required
                  value={arForm.receiptDate}
                  onChange={(e) => setArForm((s) => ({ ...s, receiptDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ar-notes">備註</Label>
                <Textarea
                  id="ar-notes"
                  rows={2}
                  value={arForm.notes}
                  onChange={(e) => setArForm((s) => ({ ...s, notes: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setArDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={arSubmitting || !editable}>
                {arSubmitting ? "送出中…" : "建立草稿"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
