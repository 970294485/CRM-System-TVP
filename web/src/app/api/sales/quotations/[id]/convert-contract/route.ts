import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb, getNeonSql } from "@/db";
import { quotations, salesContracts } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import { generateNextContractNo } from "@/lib/sales/generate-contract-no";
import { loadQuotationRowForConvert } from "@/lib/sales/load-quotation-row";
import { normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";

export const runtime = "nodejs";

function ymdFromQuoteDate(v: string | Date): string {
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  return v.toISOString().slice(0, 10);
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限建立銷售合同" }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的報價單 id" }, { status: 400 });
  }

  const q = await loadQuotationRowForConvert(idParsed.data);
  if (!q) {
    return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
  }

  if (q.status === "Converted") {
    return NextResponse.json({ error: "此報價單狀態為已轉合同，無法重複轉換" }, { status: 409 });
  }

  try {
    const db = getDb();

    const [dup] = await db
      .select({ id: salesContracts.id })
      .from(salesContracts)
      .where(eq(salesContracts.quotationId, idParsed.data))
      .limit(1);
    if (dup) {
      return NextResponse.json({ error: "此報價單已建立過銷售合同" }, { status: 409 });
    }

    const contractDate = ymdFromQuoteDate(q.quoteDate);
    const contractNo = await generateNextContractNo(db, contractDate);

    const [inserted] = await db
      .insert(salesContracts)
      .values({
        contractNo,
        sourceQuoteNo: q.quoteNo,
        quotationId: idParsed.data,
        customerId: q.customerId ?? null,
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        customerEmail: q.customerEmail,
        contractDate,
        validUntil: q.validUntil,
        items: q.items,
        subtotal: q.subtotal,
        taxRate: q.taxRate,
        taxAmount: q.taxAmount,
        totalAmount: q.totalAmount,
        status: "Active",
        notes: q.notes?.trim() ? q.notes.trim() : null,
      })
      .returning({
        id: salesContracts.id,
        contractNo: salesContracts.contractNo,
        quotationId: salesContracts.quotationId,
      });

    if (!inserted) {
      return NextResponse.json({ error: "無法建立銷售合同" }, { status: 500 });
    }

    await db.update(quotations).set({ status: "Converted" }).where(eq(quotations.id, idParsed.data));

    return NextResponse.json({ contract: inserted }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const sql = getNeonSql();
      const dupRaw = await sql.query(
        `SELECT id FROM sales_contracts WHERE quotation_id = $1::uuid LIMIT 1`,
        [idParsed.data]
      );
      const dupRows = normalizeNeonRows<{ id: string }>(dupRaw);
      if (dupRows.length > 0) {
        return NextResponse.json({ error: "此報價單已建立過銷售合同" }, { status: 409 });
      }

      const contractDate = ymdFromQuoteDate(q.quoteDate);
      const compact = contractDate.replace(/\D/g, "").slice(0, 8);
      const prefix = `CT-${compact}-`;
      const lastRaw = await sql.query(
        `SELECT contract_no FROM sales_contracts WHERE contract_no LIKE $1 ORDER BY contract_no DESC LIMIT 1`,
        [`${prefix}%`]
      );
      const lastRows = normalizeNeonRows<{ contract_no: string }>(lastRaw);
      let next = 1;
      const last = lastRows[0]?.contract_no;
      if (last) {
        const m = last.match(/-(\d+)\s*$/);
        if (m) next = parseInt(m[1]!, 10) + 1;
      }
      const contractNo = `${prefix}${String(next).padStart(3, "0")}`;

      const insRaw = await sql.query(
        `
        INSERT INTO sales_contracts (
          contract_no, source_quote_no, quotation_id, customer_id, customer_name, customer_phone, customer_email,
          contract_date, valid_until, items, subtotal, tax_rate, tax_amount, total_amount, status, notes
        )
        VALUES (
          $1, $2, $3::uuid, $4::uuid, $5, $6, $7,
          $8::date, $9::date, $10::jsonb, $11::numeric, $12::numeric, $13::numeric, $14::numeric, $15, $16
        )
        RETURNING id, contract_no, quotation_id
      `,
        [
          contractNo,
          q.quoteNo,
          idParsed.data,
          q.customerId,
          q.customerName,
          q.customerPhone,
          q.customerEmail,
          contractDate,
          q.validUntil,
          JSON.stringify(q.items),
          q.subtotal,
          q.taxRate,
          q.taxAmount,
          q.totalAmount,
          "Active",
          q.notes?.trim() ? q.notes.trim() : null,
        ]
      );
      const insRows = normalizeNeonRows<{ id: string; contract_no: string; quotation_id: string | null }>(insRaw);
      const row = insRows[0];
      if (!row) {
        throw new Error("INSERT RETURNING empty");
      }

      await sql.query(`UPDATE quotations SET status = $1 WHERE id = $2::uuid`, ["Converted", idParsed.data]);

      console.warn("[POST convert-contract] Drizzle 失敗，已改用 SQL:", msg);
      return NextResponse.json(
        {
          contract: {
            id: row.id,
            contractNo: row.contract_no,
            quotationId: row.quotation_id,
          },
        },
        { status: 201 }
      );
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[POST /api/sales/quotations/[id]/convert-contract]", msg, msg2);
      return NextResponse.json(
        {
          error: "無法轉成銷售合同",
          detail: process.env.NODE_ENV !== "production" ? `${msg} | ${msg2}` : undefined,
          hint: /sales_contracts|does not exist/i.test(`${msg}${msg2}`) ? "請執行 npm run db:apply:sales-contracts" : undefined,
        },
        { status: 500 }
      );
    }
  }
}
