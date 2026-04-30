import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeApprovalEvents, financeApprovalPolicies, financeApPaymentRequests, purchaseOrders } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import {
  completedStepIndexes,
  DOCUMENT_TYPE_AP_PAYMENT,
  isApprovalFullyDone,
  num,
  pickFinanceApprovalPolicy,
  canBypassFinanceApproval,
} from "@/lib/finance/approval-workflow";

export const runtime = "nodejs";

function nextPoPaymentStatus(totalRaw: string, paid: number): "Unpaid" | "Partial" | "Paid" {
  const t = Number(totalRaw);
  if (!Number.isFinite(t) || t <= 0) {
    return paid > 0 ? "Paid" : "Unpaid";
  }
  if (paid + 1e-6 >= t) return "Paid";
  if (paid > 0) return "Partial";
  return "Unpaid";
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm") }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "id 須為有效 UUID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數錯誤", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.action !== "confirm") {
    return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
  }

  try {
    const db = getDb();

    const [reqRow] = await db
      .select()
      .from(financeApPaymentRequests)
      .where(eq(financeApPaymentRequests.id, idParsed.data))
      .limit(1);

    if (!reqRow) {
      return NextResponse.json({ error: "請款單不存在" }, { status: 404 });
    }
    if (reqRow.status !== "Draft") {
      return NextResponse.json({ error: "僅草稿可確認付款" }, { status: 409 });
    }

    const [po] = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, reqRow.purchaseOrderId))
      .limit(1);

    if (!po) {
      return NextResponse.json({ error: "採購單不存在" }, { status: 404 });
    }

    try {
      const policies = await db.select().from(financeApprovalPolicies);
      const policy = pickFinanceApprovalPolicy(policies, DOCUMENT_TYPE_AP_PAYMENT, num(String(reqRow.amount)));
      const steps = policy?.steps ?? [];
      if (!canBypassFinanceApproval(session) && steps.length > 0) {
        const ev = await db
          .select({ stepIndex: financeApprovalEvents.stepIndex })
          .from(financeApprovalEvents)
          .where(
            and(
              eq(financeApprovalEvents.documentType, DOCUMENT_TYPE_AP_PAYMENT),
              eq(financeApprovalEvents.documentId, idParsed.data)
            )
          );
        const done = completedStepIndexes(ev.map((r) => r.stepIndex));
        if (!isApprovalFullyDone(steps.length, done)) {
          return NextResponse.json(
            {
              error:
                "此請款金額適用多層審批：須依序完成各階簽核後方可確認付款；超級管理員可繞過。請先使用「核准當前階段」。",
              approvalRequired: steps.length,
              approvalCompleted: done.size,
            },
            { status: 409 }
          );
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/finance_approval_|does not exist/i.test(msg)) throw e;
    }

    const prevPaid = Number(po.paidAmount);
    const add = Number(reqRow.amount);
    const nextPaid = (Number.isFinite(prevPaid) ? prevPaid : 0) + (Number.isFinite(add) ? add : 0);
    const paymentStatus = nextPoPaymentStatus(String(po.totalAmount), nextPaid);

    const [confirmed] = await db
      .update(financeApPaymentRequests)
      .set({
        status: "Confirmed",
        confirmedAt: new Date(),
      })
      .where(and(eq(financeApPaymentRequests.id, idParsed.data), eq(financeApPaymentRequests.status, "Draft")))
      .returning({ id: financeApPaymentRequests.id });

    if (!confirmed) {
      return NextResponse.json({ error: "僅草稿可確認付款（可能已被他人更新）" }, { status: 409 });
    }

    await db
      .update(purchaseOrders)
      .set({
        paidAmount: String(nextPaid),
        paymentStatus,
      })
      .where(eq(purchaseOrders.id, po.id));

    return NextResponse.json({
      ok: true,
      purchaseOrder: {
        id: po.id,
        paidAmount: String(nextPaid),
        paymentStatus,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/finance/ap-payment-requests/[id]]", msg);
    return NextResponse.json(
      { error: "無法更新請款單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "id 須為有效 UUID" }, { status: 400 });
  }

  try {
    const db = getDb();
    try {
      await db
        .delete(financeApprovalEvents)
        .where(
          and(
            eq(financeApprovalEvents.documentType, DOCUMENT_TYPE_AP_PAYMENT),
            eq(financeApprovalEvents.documentId, idParsed.data)
          )
        );
    } catch {
      /* 審批表未建立時略過 */
    }
    const [del] = await db
      .delete(financeApPaymentRequests)
      .where(and(eq(financeApPaymentRequests.id, idParsed.data), eq(financeApPaymentRequests.status, "Draft")))
      .returning({ id: financeApPaymentRequests.id });

    if (!del) {
      return NextResponse.json({ error: "僅草稿可刪除，或單據不存在" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/finance/ap-payment-requests/[id]]", msg);
    return NextResponse.json(
      { error: "無法刪除請款單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
