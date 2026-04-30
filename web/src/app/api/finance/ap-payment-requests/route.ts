import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeApPaymentRequests, purchaseOrders } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { listApPaymentRequestsViaNeonSql } from "@/lib/finance/ap-payment-requests-list-fallback";
import { isMissingFinanceApTableError } from "@/lib/finance/is-missing-finance-ap-table";
import { suggestFinanceDocumentNo } from "@/lib/finance/suggest-document-no";

export const runtime = "nodejs";

const postSchema = z.object({
  documentNo: z.string().min(1).max(80).optional(),
  purchaseOrderId: z.string().uuid(),
  amount: z.coerce.number().finite().positive(),
  requestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const list = await listApPaymentRequestsViaNeonSql();
    const items = list.map((r) => ({
      id: r.id,
      documentNo: r.documentNo,
      purchaseOrderId: r.purchaseOrderId,
      amount: r.amount,
      requestDate: r.requestDate.length >= 10 ? r.requestDate.slice(0, 10) : r.requestDate,
      status: r.status,
      notes: r.notes,
      confirmedAt: r.confirmedAt,
      createdAt: r.createdAt,
      poNo: r.poNo,
      poTotal: r.poTotal,
      poPaid: r.poPaid,
      poPaymentStatus: r.poPaymentStatus,
      supplierName: r.supplierName,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingFinanceApTableError(msg)) {
      console.warn("[GET /api/finance/ap-payment-requests] 表不存在，回傳空列表:", msg);
      return NextResponse.json({
        items: [],
        warning:
          "應付請款資料表尚未建立。請在 web 目錄執行：npm run db:apply:finance-payment-advance（勿在腳本名後加全形括號）",
        ...(process.env.NODE_ENV !== "production" ? { detail: msg } : {}),
      });
    }
    console.error("[GET /api/finance/ap-payment-requests]", msg);
    return NextResponse.json(
      {
        error: "無法讀取應付請款單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint:
          "若已執行 db:apply 仍失敗，請於開發者工具 Network 查看本回應的 detail（多為欄位與資料庫不一致或連線設定）",
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
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "參數錯誤", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const documentNo = parsed.data.documentNo?.trim() || suggestFinanceDocumentNo("PR-AP");

  try {
    const db = getDb();
    const [po] = await db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, parsed.data.purchaseOrderId))
      .limit(1);
    if (!po) {
      return NextResponse.json({ error: "採購單不存在" }, { status: 404 });
    }

    const [inserted] = await db
      .insert(financeApPaymentRequests)
      .values({
        documentNo,
        purchaseOrderId: parsed.data.purchaseOrderId,
        amount: String(parsed.data.amount),
        requestDate: parsed.data.requestDate,
        notes: parsed.data.notes?.trim() || null,
        createdByUserId: session.user.id,
        status: "Draft",
      })
      .returning();

    return NextResponse.json({ item: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "單號重複，請改用其他文件編號" }, { status: 409 });
    }
    console.error("[POST /api/finance/ap-payment-requests]", msg);
    return NextResponse.json(
      {
        error: "無法建立應付請款單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: isMissingFinanceApTableError(msg)
          ? "請執行 npm run db:apply:finance-payment-advance"
          : undefined,
      },
      { status: 500 }
    );
  }
}
