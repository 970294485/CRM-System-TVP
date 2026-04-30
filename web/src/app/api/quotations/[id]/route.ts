import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers, quotations } from "@/db/schema";
import type { QuotationLineItem } from "@/db/schema";
import { canEditSales } from "@/lib/authz";

export const runtime = "nodejs";

const lineItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  qty: z.coerce.number(),
  price: z.coerce.number().optional(),
  unit_price: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  line_total: z.coerce.number().optional(),
  specs: z.unknown().optional(),
});

const patchBodySchema = z.object({
  quoteNo: z.string().min(1),
  customerId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.union([z.string().uuid(), z.null()])
  ),
  customerName: z.string().min(1),
  customerPhone: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : String(v)), z.string().nullable()),
  customerEmail: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : String(v)), z.string().nullable()),
  totalAmount: z.coerce.string(),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "quoteDate 須為 YYYY-MM-DD"),
  status: z.string().min(1),
  items: z.array(lineItemSchema),
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
    const [row] = await db.select().from(quotations).where(eq(quotations.id, idParsed.data)).limit(1);
    if (!row) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }
    return NextResponse.json({ item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/quotations/[id]]", msg);
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
    return NextResponse.json(
      { error: "資料驗證失敗", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  try {
    const db = getDb();

    const [existing] = await db.select().from(quotations).where(eq(quotations.id, idParsed.data)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }

    const [dup] = await db
      .select({ id: quotations.id })
      .from(quotations)
      .where(and(eq(quotations.quoteNo, data.quoteNo), ne(quotations.id, idParsed.data)))
      .limit(1);
    if (dup) {
      return NextResponse.json({ error: "報價單號已存在，請使用其他單號" }, { status: 409 });
    }

    if (data.customerId) {
      const [cust] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, data.customerId)).limit(1);
      if (!cust) {
        return NextResponse.json({ error: "指定的客戶不存在" }, { status: 400 });
      }
    }

    const items = data.items as QuotationLineItem[];

    await db
      .update(quotations)
      .set({
        quoteNo: data.quoteNo,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        totalAmount: data.totalAmount,
        quoteDate: data.quoteDate,
        status: data.status,
        items,
      })
      .where(eq(quotations.id, idParsed.data));

    const [updated] = await db.select().from(quotations).where(eq(quotations.id, idParsed.data)).limit(1);
    return NextResponse.json({ item: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/quotations/[id]]", msg);
    return NextResponse.json(
      { error: "無法更新報價單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
