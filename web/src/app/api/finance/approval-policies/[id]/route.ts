import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeApprovalPolicies } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { normalizePolicySteps } from "@/lib/finance/approval-workflow";

export const runtime = "nodejs";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  amountMin: z.coerce.number().finite().min(0).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  steps: z
    .array(
      z.object({
        label: z.string().min(1),
        roleSlugs: z.array(z.string()).min(1),
      })
    )
    .optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });
  if (!canEditFinance(session)) return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "id 無效" }, { status: 400 });
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

  try {
    const db = getDb();
    const [existing] = await db.select().from(financeApprovalPolicies).where(eq(financeApprovalPolicies.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "策略不存在" }, { status: 404 });

    const nextActive = parsed.data.isActive ?? existing.isActive;
    let steps = existing.steps;
    if (parsed.data.steps !== undefined) {
      const normalized = normalizePolicySteps(parsed.data.steps);
      if (!normalized) {
        return NextResponse.json({ error: "steps 格式無效" }, { status: 400 });
      }
      steps = nextActive ? normalized : [];
    }
    if (nextActive && (!Array.isArray(steps) || steps.length === 0)) {
      return NextResponse.json({ error: "啟用的策略至少需要一個審批階段" }, { status: 400 });
    }

    const [row] = await db
      .update(financeApprovalPolicies)
      .set({
        ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
        ...(parsed.data.amountMin != null ? { amountMin: String(parsed.data.amountMin) } : {}),
        ...(parsed.data.isActive != null ? { isActive: parsed.data.isActive } : {}),
        ...(parsed.data.sortOrder != null ? { sortOrder: parsed.data.sortOrder } : {}),
        steps,
        updatedAt: new Date(),
      })
      .where(eq(financeApprovalPolicies.id, id))
      .returning();

    return NextResponse.json({ policy: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/finance/approval-policies/[id]]", msg);
    return NextResponse.json(
      { error: "無法更新策略", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未授權" }, { status: 401 });
  if (!canEditFinance(session)) return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "id 無效" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [del] = await db.delete(financeApprovalPolicies).where(eq(financeApprovalPolicies.id, id)).returning({
      id: financeApprovalPolicies.id,
    });
    if (!del) return NextResponse.json({ error: "策略不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/finance/approval-policies/[id]]", msg);
    return NextResponse.json(
      { error: "無法刪除策略", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
