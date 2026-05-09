"use client";

import type { QuotationPrintOrg } from "@/components/sales/quotation-print-view";

export type PaymentRequestPrintViewProps = {
  org: QuotationPrintOrg;
  bankName?: string | null;
  bankAccount?: string | null;
  documentNo: string;
  requestDate: string;
  statusLabel: string;
  supplierName: string | null;
  poNo: string;
  poTotal: string;
  poPaid: string;
  poPaymentStatusLabel: string;
  amount: string;
  notes?: string | null;
};

function fmtMoneyDisplay(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentRequestPrintView({
  org,
  bankName,
  bankAccount,
  documentNo,
  requestDate,
  statusLabel,
  supplierName,
  poNo,
  poTotal,
  poPaid,
  poPaymentStatusLabel,
  amount,
  notes,
}: PaymentRequestPrintViewProps) {
  const reqDate = requestDate.length >= 10 ? requestDate.slice(0, 10) : requestDate;

  return (
    <div className="payment-request-print-root mx-auto max-w-[210mm] bg-white p-10 text-zinc-900 shadow-sm print:shadow-none print:p-8">
      <header className="border-b border-zinc-300 pb-4">
        <div className="flex justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">請款單（應付）</h1>
            <p className="mt-1 text-xs text-zinc-500">PAYMENT REQUEST · AP</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{org?.name ?? "（公司名稱）"}</p>
            {org?.taxId ? <p className="text-zinc-600">統編 {org.taxId}</p> : null}
            {org?.address ? <p className="mt-1 text-zinc-600">{org.address}</p> : null}
            {org?.phone ? <p className="text-zinc-600">電話 {org.phone}</p> : null}
            {org?.email ? <p className="text-zinc-600">{org.email}</p> : null}
          </div>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-8 text-sm">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">付款對象（供應商）</h2>
          <p className="mt-1 font-medium">{supplierName?.trim() ? supplierName : "—"}</p>
        </div>
        <div className="text-right">
          <dl className="space-y-1">
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">請款單號</dt>
              <dd className="font-mono font-medium">{documentNo}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">請款日</dt>
              <dd>{reqDate}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">狀態</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">採購單號</dt>
              <dd className="font-mono text-xs">{poNo}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">金額摘要</h2>
        <dl className="mt-3 space-y-2">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">採購單金額（含稅）</dt>
            <dd className="tabular-nums font-medium">{fmtMoneyDisplay(poTotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">採購已付累計</dt>
            <dd className="tabular-nums">{fmtMoneyDisplay(poPaid)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-600">採購付款狀態</dt>
            <dd>{poPaymentStatusLabel}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-zinc-300 pt-2 text-base font-semibold">
            <dt>本次請款金額</dt>
            <dd className="tabular-nums">{fmtMoneyDisplay(amount)}</dd>
          </div>
        </dl>
      </section>

      {notes?.trim() ? (
        <section className="mt-8 border-t border-zinc-200 pt-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">備註／付款說明</h2>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700">{notes}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-zinc-200 pt-6 text-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">匯款指引（依企業主檔）</h2>
        {bankName?.trim() || bankAccount?.trim() ? (
          <div className="mt-2 space-y-1 text-zinc-700">
            {bankName?.trim() ? <p>開戶銀行：{bankName}</p> : null}
            {bankAccount?.trim() ? <p className="font-mono text-xs">帳號：{bankAccount}</p> : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">請至「企業基本資料」維護銀行與帳號後再列印。</p>
        )}
        <p className="mt-6 text-center text-xs text-zinc-500">
          本單據由系統依「管理請款單與預收款單」資料產生；實際付款以財務核准與銀行入帳為準。
        </p>
      </footer>
    </div>
  );
}
