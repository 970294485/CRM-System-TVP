import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { buildApApprovalStatusBatch } from "@/lib/finance/ap-approval-status";

export const runtime = "nodejs";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).max(200),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數錯誤", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = getDb();
    const map = await buildApApprovalStatusBatch(db, parsed.data.ids, session);
    const items = parsed.data.ids.map((id) => map.get(id) ?? null).filter(Boolean);
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/finance_approval_|does not exist/i.test(msg)) {
      return NextResponse.json({
        items: parsed.data.ids.map((id) => ({
          id,
          policyId: null,
          policyName: null,
          totalSteps: 0,
          completedSteps: 0,
          steps: [],
          canSignNextStep: false,
          canFinalizeConfirm: true,
        })),
        warning: "審批表尚未建立，未套用多層審批。請執行 npm run db:apply:finance-approval",
      });
    }
    console.error("[POST /api/finance/ap-payment-requests/approval-status]", msg);
    return NextResponse.json(
      { error: "無法計算審批狀態", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
