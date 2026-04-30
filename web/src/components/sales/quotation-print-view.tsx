"use client";

export type QuotationPrintOrg = {
  name: string;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
} | null;

export type QuotationPrintLine = {
  name: string;
  sku: string | null;
  qty: number;
  unit_price: number;
  discount: number;
  line_total: number;
};

export type QuotationPrintViewProps = {
  org: QuotationPrintOrg;
  quoteNo: string;
  quoteDate: string;
  validUntil: string;
  customerName: string;
  customerCode: string | null;
  contactName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  lines: QuotationPrintLine[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function QuotationPrintView({
  org,
  quoteNo,
  quoteDate,
  validUntil,
  customerName,
  customerCode,
  contactName,
  customerPhone,
  customerEmail,
  customerAddress,
  lines,
  subtotal,
  taxRate,
  taxAmount,
  totalAmount,
  notes,
}: QuotationPrintViewProps) {
  return (
    <div className="quotation-print-root mx-auto max-w-[210mm] bg-white p-10 text-zinc-900 shadow-sm print:shadow-none print:p-8">
      <header className="border-b border-zinc-300 pb-4">
        <div className="flex justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">報價單</h1>
            <p className="mt-1 text-xs text-zinc-500">QUOTATION</p>
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
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">客戶</h2>
          <p className="mt-1 font-medium">{customerName}</p>
          {customerCode ? <p className="text-zinc-600">編號 {customerCode}</p> : null}
          {contactName ? <p className="text-zinc-600">聯絡人 {contactName}</p> : null}
          {customerPhone ? <p className="text-zinc-600">{customerPhone}</p> : null}
          {customerEmail ? <p className="text-zinc-600">{customerEmail}</p> : null}
          {customerAddress ? <p className="mt-1 text-zinc-600">{customerAddress}</p> : null}
        </div>
        <div className="text-right">
          <dl className="space-y-1">
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">單號</dt>
              <dd className="font-mono font-medium">{quoteNo}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">報價日</dt>
              <dd>{quoteDate}</dd>
            </div>
            <div className="flex justify-end gap-3">
              <dt className="text-zinc-500">有效至</dt>
              <dd>{validUntil}</dd>
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
            <th className="px-2 py-2 text-right font-semibold">單價</th>
            <th className="px-2 py-2 text-right font-semibold">折扣%</th>
            <th className="px-2 py-2 text-right font-semibold">小計</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={`${i}-${line.name}`} className="border-b border-zinc-200">
              <td className="px-2 py-2 text-zinc-500">{i + 1}</td>
              <td className="px-2 py-2 font-medium">{line.name}</td>
              <td className="px-2 py-2 font-mono text-xs text-zinc-600">{line.sku ?? "—"}</td>
              <td className="px-2 py-2 text-right tabular-nums">{line.qty}</td>
              <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(line.unit_price)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{line.discount}</td>
              <td className="px-2 py-2 text-right tabular-nums font-medium">{fmtMoney(line.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-600">未稅小計</dt>
            <dd className="tabular-nums">{fmtMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-600">稅率 {taxRate}%</dt>
            <dd className="tabular-nums">{fmtMoney(taxAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-zinc-300 pt-2 text-base font-semibold">
            <dt>含稅總計</dt>
            <dd className="tabular-nums">{fmtMoney(totalAmount)}</dd>
          </div>
        </dl>
      </div>

      {notes?.trim() ? (
        <section className="mt-8 border-t border-zinc-200 pt-4 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">備註與條款</h2>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700">{notes}</p>
        </section>
      ) : null}

      <footer className="mt-16 grid grid-cols-2 gap-12 border-t border-zinc-200 pt-8 text-sm text-zinc-600">
        <div>
          <p className="font-medium text-zinc-900">客戶簽章</p>
          <div className="mt-8 h-20 border-b border-zinc-300" />
        </div>
        <div>
          <p className="font-medium text-zinc-900">公司簽章</p>
          <div className="mt-8 h-20 border-b border-zinc-300" />
        </div>
      </footer>
    </div>
  );
}
