import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { documentCategories } from "@/db/schema";
import { canManageDocuments } from "@/lib/authz";
import { documentCategoryCreateSchema } from "@/lib/validations/document-classification";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db.select().from(documentCategories).orderBy(asc(documentCategories.name));
    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /document_categories|does not exist/i.test(msg)
        ? "資料表可能尚未建立。請執行 web/sql/document_classification_init.sql，或 npm run db:migrate"
        : undefined;
    console.error("[GET /api/document-categories]", msg);
    return NextResponse.json(
      { error: "無法讀取文件分類", detail: process.env.NODE_ENV !== "production" ? msg : undefined, hint },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canManageDocuments(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = documentCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const description =
    parsed.data.description != null && parsed.data.description.trim() !== ""
      ? parsed.data.description.trim()
      : null;

  try {
    const db = getDb();
    const [row] = await db
      .insert(documentCategories)
      .values({
        name: parsed.data.name.trim(),
        description,
      })
      .returning();

    if (!row) {
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "此分類名稱已存在" }, { status: 409 });
    }
    console.error("[POST /api/document-categories]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
