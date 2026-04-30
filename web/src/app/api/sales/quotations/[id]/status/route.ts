import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { quotations } from "@/db/schema";
import { canEditSales } from "@/lib/authz";

export const runtime = "nodejs";

const bodySchema = z.object({
  status: z.enum(["Draft", "Sent", "Accepted", "Expired", "Converted"]),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditSales(session)) {
    return NextResponse.json({ error: "無權限更新報價狀態" }, { status: 403 });
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "資料驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = getDb();
    const [existing] = await db.select().from(quotations).where(eq(quotations.id, idParsed.data)).limit(1);
    if (!existing) {
      return NextResponse.json({ error: "找不到報價單" }, { status: 404 });
    }

    await db.update(quotations).set({ status: parsed.data.status }).where(eq(quotations.id, idParsed.data));

    const [updated] = await db.select().from(quotations).where(eq(quotations.id, idParsed.data)).limit(1);
    return NextResponse.json({ item: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/sales/quotations/[id]/status]", msg);
    return NextResponse.json(
      { error: "無法更新狀態", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
