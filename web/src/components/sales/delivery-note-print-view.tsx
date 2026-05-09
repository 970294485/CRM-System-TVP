"use client";

import type { QuotationPrintOrg } from "@/components/sales/quotation-print-view";

export type DeliveryNotePrintLine = {
  name: string;
  sku: string | null;
  qty: number;
};

export type DeliveryNotePrintViewProps = {
  org: QuotationPrintOrg;
  dnNo: string;
  shipDate: string;
  sourceContractNo: string;
  statusLabel: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  shipToAddress?: string | null;
  lines: DeliveryNotePrintLine[];
  notes?: string | null;
};

export function DeliveryNotePrintView({
  org,
  dnNo,
  shipDate,
  sourceContractNo,
  statusLabel,
  customerName,
  customerPhone,
  customerEmail,
  shipToAddress,
  lines,
  notes,
}: DeliveryNotePrintViewProps) {
  return (
    <div className="delivery-note-print-root mx-auto max-w-[210mm] bg-white p-10 text-zinc-900 shadow-sm print:shadow-none print:p-8">
      <header className="border-b border-zinc-300 pb-4">
        <div className="flex justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">送貨單</h1>
            <p className="mt-1 text-xs text-zinc-500">DELIVERY NOTE</p>
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">送貨／收貨資訊</h2>
          <p className="mt-1 font-medium">{customerName}</p>
          {customerPhone ? <p className="text-zinc-600">{customerPhone}</p> : null}
          {customerEmail ? <p className="text-zinc-600">{customerEmail}</p> : null}
          {shipToAddress?.trim() ? (
            <p className="mt-2 whitespace-pre-wrap text-zinc-700">送貨地址：{shipToAddress}</p>
          ) : null}
        </div>
        <div className="text-right">
          <dl className="space-y-1">
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">送貨單號</dt>
              <dd className="font-mono font-medium">{dnNo}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">狀態</dt>
              <dd>{statusLabel}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">出貨日</dt>
              <dd>{shipDate}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">來源合同</dt>
              <dd className="font-mono text-xs">{sourceContractNo}</dd>
            </div>
          </dl>
        </div>
      </section>

      <table className="mt-8 w-full border-collapse text-sm print:text-[13px]">
        <thead>
          <tr className="border-y border-zinc-900 bg-zinc-50">
            <th className="px-2 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">品名</th>
            <th className="px-2 py-2 text-left font-semibold">SKU</th>
            <th className="px-2 py-2 text-right font-semibold">數量</th>
            <th className="px-2 py-2 text-right font-semibold text-zinc-500">核對</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={`${i}-${line.name}`} className="border-b border-zinc-200">
              <td className="px-2 py-2 text-zinc-500">{i + 1}</td>
              <td className="px-2 py-2 font-medium">{line.name}</td>
              <td className="px-2 py-2 font-mono text-xs text-zinc-600">{line.sku ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{line.qty}</td>
              <td className="px-2 py-2 text-right border-b border-dashed border-zinc-300">&nbsp;</td>
            </tr>
          ))}
        </tbody>
      </table>

      {notes?.trim() ? (
        <section className="mt-8 border-t border-zinc-200 pt-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">備註</h2>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700">{notes}</p>
        </section>
      ) : null}

      <footer className="mt-16 grid gap-8 border-t border-zinc-200 pt-8 text-sm text-zinc-700">
        <p className="text-center text-xs text-zinc-500">
          請於收貨時核對品項與數量；如有短溢裝請於送貨單上註記並簽收。
        </p>
        <div className="flex justify-between gap-8 print:mt-8">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">送貨人簽名</p>
            <div className="mt-10 border-b border-zinc-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">客戶簽收</p>
            <div className="mt-10 border-b border-zinc-400" />
          </div>
        </div>
        <p className="text-center text-xs text-zinc-500">簽收日期：______________</p>
      </footer>
    </div>
  );
}
