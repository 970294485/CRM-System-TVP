import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { customerServiceCasePatchSchema } from "@/lib/validations/customer-service";
import { getDb } from "@/db";
import { customerServiceCaseNotes, customerServiceCases, users } from "@/db/schema";

export const runtime = "nodejs";

function missingTableHint(msg: string): string | undefined {
  if (/customer_service_cases|customer_service_case_notes|relation|does not exist/i.test(msg)) {
    return "請在 web 目錄執行：npm run db:apply:customer-service-init";
  }
  return undefined;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select()
      .from(customerServiceCases)
      .where(eq(customerServiceCases.id, idParsed.data))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "找不到案件" }, { status: 404 });
    }

    const notes = await db
      .select({
        id: customerServiceCaseNotes.id,
        body: customerServiceCaseNotes.body,
        createdAt: customerServiceCaseNotes.createdAt,
        authorName: users.name,
      })
      .from(customerServiceCaseNotes)
      .leftJoin(users, eq(customerServiceCaseNotes.createdByUserId, users.id))
      .where(eq(customerServiceCaseNotes.caseId, idParsed.data))
      .orderBy(desc(customerServiceCaseNotes.createdAt));

    return NextResponse.json({ item: row, notes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/customer-service/cases/[id]]", msg);
    return NextResponse.json(
      {
        error: "無法讀取案件",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: missingTableHint(msg),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = customerServiceCasePatchSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "沒有可更新的欄位" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [updated] = await db
      .update(customerServiceCases)
      .set({
        ...patch,
        summary: patch.summary === undefined ? undefined : patch.summary,
        updatedAt: new Date(),
      })
      .where(eq(customerServiceCases.id, idParsed.data))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "找不到案件" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/customer-service/cases/[id]]", msg);
    return NextResponse.json(
      {
        error: "無法更新案件",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: missingTableHint(msg),
      },
      { status: 500 }
    );
  }
}
