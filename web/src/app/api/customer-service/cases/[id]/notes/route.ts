import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { customerServiceNoteCreateSchema } from "@/lib/validations/customer-service";
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
    const [exists] = await db
      .select({ id: customerServiceCases.id })
      .from(customerServiceCases)
      .where(eq(customerServiceCases.id, idParsed.data))
      .limit(1);
    if (!exists) {
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

    return NextResponse.json({ items: notes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/customer-service/cases/[id]/notes]", msg);
    return NextResponse.json(
      {
        error: "無法讀取備註",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: missingTableHint(msg),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
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

  const parsed = customerServiceNoteCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [c] = await db
      .select({ id: customerServiceCases.id })
      .from(customerServiceCases)
      .where(eq(customerServiceCases.id, idParsed.data))
      .limit(1);
    if (!c) {
      return NextResponse.json({ error: "找不到案件" }, { status: 404 });
    }

    const [note] = await db
      .insert(customerServiceCaseNotes)
      .values({
        caseId: idParsed.data,
        body: parsed.data.body,
        createdByUserId: userId,
      })
      .returning();

    await db
      .update(customerServiceCases)
      .set({ updatedAt: new Date() })
      .where(eq(customerServiceCases.id, idParsed.data));

    if (!note) {
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: note });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/customer-service/cases/[id]/notes]", msg);
    return NextResponse.json(
      {
        error: "無法新增備註",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: missingTableHint(msg),
      },
      { status: 500 }
    );
  }
}
