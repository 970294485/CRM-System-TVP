import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeApprovalEvents, financeApprovalPolicies, financeApPaymentRequests } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { buildApApprovalStatusBatch } from "@/lib/finance/ap-approval-status";
import {
  canUserSignStep,
  completedStepIndexes,
  DOCUMENT_TYPE_AP_PAYMENT,
  nextMissingStepIndex,
  num,
  pickFinanceApprovalPolicy,
} from "@/lib/finance/approval-workflow";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "id 無效" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [ap] = await db.select().from(financeApPaymentRequests).where(eq(financeApPaymentRequests.id, id)).limit(1);
    if (!ap) return NextResponse.json({ error: "請款單不存在" }, { status: 404 });
    if (ap.status !== "Draft") return NextResponse.json({ error: "僅草稿可簽署審批" }, { status: 409 });

    const policies = await db.select().from(financeApprovalPolicies);
    const policy = pickFinanceApprovalPolicy(policies, DOCUMENT_TYPE_AP_PAYMENT, num(String(ap.amount)));
    const steps = policy?.steps ?? [];
    if (!steps.length) {
      return NextResponse.json({ error: "無適用之審批策略（或策略未啟用／無階段）" }, { status: 409 });
    }

    const evRows = await db
      .select({ stepIndex: financeApprovalEvents.stepIndex })
      .from(financeApprovalEvents)
      .where(and(eq(financeApprovalEvents.documentType, DOCUMENT_TYPE_AP_PAYMENT), eq(financeApprovalEvents.documentId, id)));

    const done = completedStepIndexes(evRows.map((r) => r.stepIndex));
    const missing = nextMissingStepIndex(steps.length, done);
    if (missing === null) {
      return NextResponse.json({ error: "審批已完成，請使用「確認付款」" }, { status: 409 });
    }

    const stepDef = steps[missing];
    if (!canUserSignStep(session, stepDef)) {
      return NextResponse.json(
        {
          error: `您無權限簽署「${stepDef?.label ?? "—"}」：需下列角色之一：${(stepDef?.roleSlugs ?? []).join(", ")}；超級管理員可繞過。`,
        },
        { status: 403 }
      );
    }

    await db.insert(financeApprovalEvents).values({
      documentType: DOCUMENT_TYPE_AP_PAYMENT,
      documentId: id,
      stepIndex: missing,
      actorUserId: session.user.id,
    });

    const refreshed = await buildApApprovalStatusBatch(db, [id], session);
    return NextResponse.json({ ok: true, status: refreshed.get(id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "該階段已簽過，請重新載入頁面" }, { status: 409 });
    }
    console.error("[POST /api/finance/ap-payment-requests/[id]/approval-step]", msg);
    return NextResponse.json(
      { error: "無法記錄審批", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
