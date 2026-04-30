import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb, getNeonSql } from "@/db";
import { proformaInvoices, salesContracts, type QuotationLineItem } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import { generateNextProformaInvoiceNo } from "@/lib/sales/generate-proforma-no";
import { splitInclusiveTaxTotal } from "@/lib/sales/quotation-math";
import { normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";

export const runtime = "nodejs";

function ymdToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function numOrZero(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限開立預收發票" }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的合同 id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [c] = await db
      .select({
        id: salesContracts.id,
        contractNo: salesContracts.contractNo,
        customerId: salesContracts.customerId,
        customerName: salesContracts.customerName,
        customerPhone: salesContracts.customerPhone,
        customerEmail: salesContracts.customerEmail,
        prepaymentAmount: salesContracts.prepaymentAmount,
        taxRate: salesContracts.taxRate,
        status: salesContracts.status,
      })
      .from(salesContracts)
      .where(eq(salesContracts.id, idParsed.data))
      .limit(1);

    if (!c) {
      return NextResponse.json({ error: "找不到銷售合同" }, { status: 404 });
    }

    if (c.status !== "Active") {
      return NextResponse.json({ error: "僅「生效中」合同可開立預收發票" }, { status: 400 });
    }

    const prepay = numOrZero(c.prepaymentAmount);
    if (prepay <= 0) {
      return NextResponse.json({ error: "請先設定預收款金額（大於 0）" }, { status: 400 });
    }

    const [dup] = await db
      .select({ id: proformaInvoices.id })
      .from(proformaInvoices)
      .where(eq(proformaInvoices.contractId, idParsed.data))
      .limit(1);
    if (dup) {
      return NextResponse.json({ error: "此合同已開立過預收發票" }, { status: 409 });
    }

    const taxRate = numOrZero(c.taxRate);
    const { subtotal, tax_amount, total_amount } = splitInclusiveTaxTotal(prepay, taxRate);

    const lineName = `預收款（合同 ${c.contractNo}）`;
    const items: QuotationLineItem[] = [
      normalizeLineForProforma(lineName, subtotal),
    ];

    const issueDate = ymdToday();
    const invoiceNo = await generateNextProformaInvoiceNo(db, issueDate);

    const [inserted] = await db
      .insert(proformaInvoices)
      .values({
        invoiceNo,
        contractId: idParsed.data,
        sourceContractNo: c.contractNo,
        customerId: c.customerId ?? null,
        customerName: c.customerName,
        customerPhone: c.customerPhone,
        customerEmail: c.customerEmail,
        issueDate,
        items,
        subtotal: String(subtotal),
        taxRate: String(taxRate),
        taxAmount: String(tax_amount),
        totalAmount: String(total_amount),
        status: "Issued",
        notes: null,
      })
      .returning({
        id: proformaInvoices.id,
        invoiceNo: proformaInvoices.invoiceNo,
        contractId: proformaInvoices.contractId,
        totalAmount: proformaInvoices.totalAmount,
      });

    if (!inserted) {
      return NextResponse.json({ error: "無法建立預收發票" }, { status: 500 });
    }

    return NextResponse.json({ proforma: inserted }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const sql = getNeonSql();
      const cRaw = await sql.query(
        `
        SELECT id, contract_no, customer_id, customer_name, customer_phone, customer_email,
               prepayment_amount::text AS prepayment_amount, tax_rate::text AS tax_rate, status
        FROM sales_contracts WHERE id = $1::uuid LIMIT 1
      `,
        [idParsed.data]
      );
      const cRows = normalizeNeonRows<{
        id: string;
        contract_no: string;
        customer_id: string | null;
        customer_name: string;
        customer_phone: string | null;
        customer_email: string | null;
        prepayment_amount: string | null;
        tax_rate: string | null;
        status: string;
      }>(cRaw);
      const c = cRows[0];
      if (!c) {
        return NextResponse.json({ error: "找不到銷售合同" }, { status: 404 });
      }
      if (c.status !== "Active") {
        return NextResponse.json({ error: "僅「生效中」合同可開立預收發票" }, { status: 400 });
      }
      const prepay = numOrZero(c.prepayment_amount);
      if (prepay <= 0) {
        return NextResponse.json({ error: "請先設定預收款金額（大於 0）" }, { status: 400 });
      }

      const dupRaw = await sql.query(
        `SELECT id FROM proforma_invoices WHERE contract_id = $1::uuid LIMIT 1`,
        [idParsed.data]
      );
      if (normalizeNeonRows<{ id: string }>(dupRaw).length > 0) {
        return NextResponse.json({ error: "此合同已開立過預收發票" }, { status: 409 });
      }

      const taxRate = numOrZero(c.tax_rate);
      const { subtotal, tax_amount, total_amount } = splitInclusiveTaxTotal(prepay, taxRate);
      const lineName = `預收款（合同 ${c.contract_no}）`;
      const items: QuotationLineItem[] = [normalizeLineForProforma(lineName, subtotal)];

      const issueDate = ymdToday();
      const compact = issueDate.replace(/\D/g, "").slice(0, 8);
      const prefix = `PF-${compact}-`;
      const lastRaw = await sql.query(
        `SELECT invoice_no FROM proforma_invoices WHERE invoice_no LIKE $1 ORDER BY invoice_no DESC LIMIT 1`,
        [`${prefix}%`]
      );
      const lastRows = normalizeNeonRows<{ invoice_no: string }>(lastRaw);
      let next = 1;
      const last = lastRows[0]?.invoice_no;
      if (last) {
        const m = last.match(/-(\d+)\s*$/);
        if (m) next = parseInt(m[1]!, 10) + 1;
      }
      const invoiceNo = `${prefix}${String(next).padStart(3, "0")}`;

      const insRaw = await sql.query(
        `
        INSERT INTO proforma_invoices (
          invoice_no, contract_id, source_contract_no, customer_id, customer_name, customer_phone, customer_email,
          issue_date, items, subtotal, tax_rate, tax_amount, total_amount, status, notes
        )
        VALUES (
          $1, $2::uuid, $3, $4::uuid, $5, $6, $7,
          $8::date, $9::jsonb, $10::numeric, $11::numeric, $12::numeric, $13::numeric, $14, $15
        )
        RETURNING id, invoice_no, contract_id, total_amount::text AS total_amount
      `,
        [
          invoiceNo,
          idParsed.data,
          c.contract_no,
          c.customer_id,
          c.customer_name,
          c.customer_phone,
          c.customer_email,
          issueDate,
          JSON.stringify(items),
          subtotal,
          taxRate,
          tax_amount,
          total_amount,
          "Issued",
          null,
        ]
      );
      const ins = normalizeNeonRows<{ id: string; invoice_no: string; contract_id: string; total_amount: string }>(
        insRaw
      )[0];
      if (!ins) throw new Error("INSERT RETURNING empty");

      console.warn("[POST convert-proforma] Drizzle 失敗，已改用 SQL:", msg);
      return NextResponse.json(
        {
          proforma: {
            id: ins.id,
            invoiceNo: ins.invoice_no,
            contractId: ins.contract_id,
            totalAmount: ins.total_amount,
          },
        },
        { status: 201 }
      );
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[POST /api/sales/contracts/[id]/convert-proforma]", msg, msg2);
      return NextResponse.json(
        {
          error: "無法開立預收發票",
          detail: process.env.NODE_ENV !== "production" ? `${msg} | ${msg2}` : undefined,
          hint: /proforma_invoices|does not exist/i.test(`${msg}${msg2}`) ? "請執行 npm run db:apply:contracts-prepayment" : undefined,
        },
        { status: 500 }
      );
    }
  }
}

function normalizeLineForProforma(name: string, lineSubtotal: number): QuotationLineItem {
  return {
    name,
    qty: 1,
    unit_price: lineSubtotal,
    discount: 0,
    line_total: lineSubtotal,
  };
}
