import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb, getNeonSql } from "@/db";
import { customers, quotations, type QuotationLineItem } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import { getQuotationByIdViaLegacySql, normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";
import { normalizeItemsForPersist, totalsFromLines } from "@/lib/sales/quotation-math";

export const runtime = "nodejs";

const lineSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
  name: z.string().min(1),
  qty: z.coerce.number(),
  unit_price: z.coerce.number(),
  discount: z.coerce.number().min(0).max(100).optional().default(0),
});

const patchBodySchema = z.object({
  customer_id: z.string().uuid(),
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tax_rate: z.coerce.number().min(0).max(100).optional().default(5),
  items: z.array(lineSchema).min(1),
  notes: z.string().optional().nullable(),
  status: z
    .enum(["Draft", "Sent", "Accepted", "Expired", "Converted", "Legacy_Imported"])
    .optional(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的報價單 id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: quotations.id,
        quoteNo: quotations.quoteNo,
        customerId: quotations.customerId,
        customerName: quotations.customerName,
        customerPhone: quotations.customerPhone,
        customerEmail: quotations.customerEmail,
        quoteDate: quotations.quoteDate,
        validUntil: quotations.validUntil,
        items: quotations.items,
        subtotal: quotations.subtotal,
        taxRate: quotations.taxRate,
        taxAmount: quotations.taxAmount,
        totalAmount: quotations.totalAmount,
        status: quotations.status,
        notes: quotations.notes,
        joinedCustomerName: customers.name,
        joinedCustomerCode: customers.customerCode,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(eq(quotations.id, idParsed.data))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: row.id,
        quoteNo: row.quoteNo,
        customerId: row.customerId,
        customerName: row.joinedCustomerName ?? row.customerName,
        customerCode: row.joinedCustomerCode ?? null,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
        quoteDate: row.quoteDate,
        validUntil: row.validUntil,
        items: row.items,
        subtotal: row.subtotal,
        taxRate: row.taxRate,
        taxAmount: row.taxAmount,
        totalAmount: row.totalAmount,
        status: row.status,
        notes: row.notes,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const legacy = await getQuotationByIdViaLegacySql(idParsed.data);
      if (!legacy) {
        return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
      }
      console.warn("[GET /api/sales/quotations/[id]] Drizzle 失敗，已改用基底 SQL:", msg);
      return NextResponse.json({ item: legacy });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[GET /api/sales/quotations/[id]] 降級查詢失敗", msg2);
    }
    console.error("[GET /api/sales/quotations/[id]]", msg);
    return NextResponse.json(
      { error: "無法讀取報價單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限修改報價單" }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的報價單 id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求內容須為 JSON" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const db = getDb();

    const [existing] = await db
      .select({ id: quotations.id })
      .from(quotations)
      .where(eq(quotations.id, idParsed.data))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }

    const [cust] = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
      })
      .from(customers)
      .where(eq(customers.id, data.customer_id))
      .limit(1);

    if (!cust) {
      return NextResponse.json({ error: "指定的客戶不存在" }, { status: 400 });
    }

    const rawItems: QuotationLineItem[] = data.items.map((l) => ({
      product_id: l.product_id,
      sku: l.sku,
      name: l.name.trim(),
      qty: l.qty,
      unit_price: l.unit_price,
      discount: l.discount ?? 0,
    }));

    const itemsNorm = normalizeItemsForPersist(rawItems);
    if (itemsNorm.length === 0) {
      return NextResponse.json({ error: "至少需一筆有效品項" }, { status: 400 });
    }

    const lineTotals = itemsNorm.map((l) => l.line_total ?? 0);
    const { subtotal, tax_amount, total_amount } = totalsFromLines(lineTotals, data.tax_rate);

    await db
      .update(quotations)
      .set({
        customerId: data.customer_id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerEmail: cust.email,
        quoteDate: data.quote_date,
        validUntil: data.valid_until,
        items: itemsNorm,
        subtotal: String(subtotal),
        taxRate: String(data.tax_rate),
        taxAmount: String(tax_amount),
        totalAmount: String(total_amount),
        notes: data.notes?.trim() ? data.notes.trim() : null,
        ...(data.status !== undefined ? { status: data.status } : {}),
      })
      .where(eq(quotations.id, idParsed.data));

    const [updated] = await db
      .select({
        id: quotations.id,
        quoteNo: quotations.quoteNo,
        customerId: quotations.customerId,
        customerName: quotations.customerName,
        customerPhone: quotations.customerPhone,
        customerEmail: quotations.customerEmail,
        quoteDate: quotations.quoteDate,
        validUntil: quotations.validUntil,
        items: quotations.items,
        subtotal: quotations.subtotal,
        taxRate: quotations.taxRate,
        taxAmount: quotations.taxAmount,
        totalAmount: quotations.totalAmount,
        status: quotations.status,
        notes: quotations.notes,
        joinedCustomerName: customers.name,
        joinedCustomerCode: customers.customerCode,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(eq(quotations.id, idParsed.data))
      .limit(1);

    return NextResponse.json({
      item: updated
        ? {
            id: updated.id,
            quoteNo: updated.quoteNo,
            customerId: updated.customerId,
            customerName: updated.joinedCustomerName ?? updated.customerName,
            customerCode: updated.joinedCustomerCode ?? null,
            customerPhone: updated.customerPhone,
            customerEmail: updated.customerEmail,
            quoteDate: updated.quoteDate,
            validUntil: updated.validUntil,
            items: updated.items,
            subtotal: updated.subtotal,
            taxRate: updated.taxRate,
            taxAmount: updated.taxAmount,
            totalAmount: updated.totalAmount,
            status: updated.status,
            notes: updated.notes,
          }
        : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/sales/quotations/[id]]", msg);
    return NextResponse.json(
      { error: "無法更新報價單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限刪除報價單" }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的報價單 id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: quotations.id })
      .from(quotations)
      .where(eq(quotations.id, idParsed.data))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }

    await db.delete(quotations).where(eq(quotations.id, idParsed.data));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const sql = getNeonSql();
      const raw = await sql.query(`DELETE FROM quotations WHERE id = $1::uuid RETURNING id`, [idParsed.data]);
      const deleted = normalizeNeonRows<{ id: string }>(raw);
      if (deleted.length === 0) {
        return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
      }
      console.warn("[DELETE /api/sales/quotations/[id]] Drizzle 失敗，已改用 SQL 刪除:", msg);
      return NextResponse.json({ ok: true });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[DELETE /api/sales/quotations/[id]]", msg, msg2);
      return NextResponse.json(
        {
          error: "無法刪除報價單",
          detail: process.env.NODE_ENV !== "production" ? `${msg} | ${msg2}` : undefined,
        },
        { status: 500 }
      );
    }
  }
}
