import { asc, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeApprovalPolicies } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { normalizePolicySteps } from "@/lib/finance/approval-workflow";

export const runtime = "nodejs";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  documentType: z.literal("AP_PAYMENT"),
  amountMin: z.coerce.number().finite().min(0),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().optional(),
  steps: z
    .array(
      z.object({
        label: z.string().min(1),
        roleSlugs: z.array(z.string()).min(1),
      })
    )
    .default([]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(financeApprovalPolicies)
      .orderBy(
        asc(financeApprovalPolicies.documentType),
        desc(financeApprovalPolicies.amountMin),
        asc(financeApprovalPolicies.sortOrder)
      );

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      documentType: r.documentType,
      amountMin: String(r.amountMin),
      isActive: r.isActive,
      steps: Array.isArray(r.steps) ? r.steps : [],
      sortOrder: r.sortOrder,
      createdAt: r.createdAt?.toISOString(),
      updatedAt: r.updatedAt?.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/finance_approval_policies|does not exist/i.test(msg)) {
      return NextResponse.json({
        items: [],
        warning: "審批策略表尚未建立。請執行 npm run db:apply:finance-approval",
      });
    }
    console.error("[GET /api/finance/approval-policies]", msg);
    return NextResponse.json(
      { error: "無法讀取策略", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
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
    return NextResponse.json({ error: "參數錯誤", issues: parsed.error.flatten() }, { status: 400 });
  }

  const normalized = normalizePolicySteps(parsed.data.steps) ?? [];
  if (parsed.data.isActive && normalized.length === 0) {
    return NextResponse.json({ error: "啟用的策略至少需要一個審批階段（含標籤與角色 slug）" }, { status: 400 });
  }
  const stepsToStore = parsed.data.isActive ? normalized : [];

  try {
    const db = getDb();
    const [row] = await db
      .insert(financeApprovalPolicies)
      .values({
        name: parsed.data.name.trim(),
        documentType: parsed.data.documentType,
        amountMin: String(parsed.data.amountMin),
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder ?? 0,
        steps: stepsToStore,
        updatedAt: new Date(),
      })
      .returning();

    return NextResponse.json({ policy: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/finance/approval-policies]", msg);
    return NextResponse.json(
      {
        error: "無法建立策略",
        hint: /does not exist/i.test(msg) ? "請執行 npm run db:apply:finance-approval" : undefined,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
