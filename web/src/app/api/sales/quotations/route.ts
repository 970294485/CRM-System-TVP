import { asc, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers, quotations, type QuotationLineItem } from "@/db/schema";
import { canEditSales } from "@/lib/authz";
import { generateNextQuoteNo } from "@/lib/sales/generate-quote-no";
import { listQuotationsViaLegacySql } from "@/lib/sales/quotations-list-fallback";
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

const postBodySchema = z.object({
  customer_id: z.string().uuid(),
  quote_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tax_rate: z.coerce.number().min(0).max(100).optional().default(5),
  items: z.array(lineSchema).min(1),
  notes: z.string().optional().nullable(),
  status: z.enum(["Draft", "Sent", "Accepted", "Expired", "Converted"]).optional().default("Draft"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const rawCustomerId = req.nextUrl.searchParams.get("customerId");
  const customerIdParsed = rawCustomerId
    ? z.string().uuid().safeParse(rawCustomerId)
    : { success: true as const, data: undefined as string | undefined };
  if (!customerIdParsed.success) {
    return NextResponse.json({ error: "customerId 須為有效 UUID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const order = [desc(quotations.quoteDate), asc(quotations.quoteNo)] as const;

    const base = db
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
      .leftJoin(customers, eq(quotations.customerId, customers.id));

    const rows =
      customerIdParsed.data !== undefined
        ? await base.where(eq(quotations.customerId, customerIdParsed.data)).orderBy(...order)
        : await base.orderBy(...order);

    const items = rows.map((r) => ({
      id: r.id,
      quoteNo: r.quoteNo,
      customerId: r.customerId,
      customerName: r.joinedCustomerName ?? r.customerName,
      customerCode: r.joinedCustomerCode ?? null,
      customerPhone: r.customerPhone,
      customerEmail: r.customerEmail,
      quoteDate: r.quoteDate,
      validUntil: r.validUntil,
      items: r.items,
      subtotal: r.subtotal,
      taxRate: r.taxRate,
      taxAmount: r.taxAmount,
      totalAmount: r.totalAmount,
      status: r.status,
      notes: r.notes,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const items = await listQuotationsViaLegacySql(customerIdParsed.data);
      console.warn("[GET /api/sales/quotations] Drizzle 失敗，已改用基底 SQL 列表:", msg);
      return NextResponse.json({ items });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[GET /api/sales/quotations] 降級查詢失敗", msg2);
    }
    const hint = /column|does not exist/i.test(msg) ? "請執行 npm run db:apply:quotations-sales" : undefined;
    console.error("[GET /api/sales/quotations]", msg);
    return NextResponse.json(
      {
        error: "無法讀取報價單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限建立報價單" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "請求內容須為 JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const db = getDb();

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

    const quoteNo = await generateNextQuoteNo(db, data.quote_date);

    const [inserted] = await db
      .insert(quotations)
      .values({
        quoteNo,
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
        status: data.status,
        notes: data.notes?.trim() ? data.notes.trim() : null,
      })
      .returning();

    return NextResponse.json({ item: inserted }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/sales/quotations]", msg);
    return NextResponse.json(
      { error: "無法建立報價單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
