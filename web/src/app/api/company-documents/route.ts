import { randomUUID } from "crypto";

import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { companyDocumentPermissions, companyDocuments, users } from "@/db/schema";
import { companyDocumentsSchemaHint } from "@/lib/db-errors";

export const runtime = "nodejs";

const ACCESS = { PUBLIC: "PUBLIC", RESTRICTED: "RESTRICTED" } as const;

function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** GET: 列表（依權限過濾）— 支援 ?q= 關鍵字、?category= */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();

  try {
    const db = getDb();

    /** 先單獨查授權表，主查詢只用 `IN ($uuid,...)`，避免 Neon HTTP 對子查詢 / IN(subselect) 的相容問題 */
    const permRows = await db
      .select({ documentId: companyDocumentPermissions.documentId })
      .from(companyDocumentPermissions)
      .where(eq(companyDocumentPermissions.userId, userId));

    const permittedIds = [...new Set(permRows.map((r) => r.documentId))];

    const restrictedVisibility = and(
      eq(companyDocuments.accessType, ACCESS.RESTRICTED),
      permittedIds.length > 0
        ? or(eq(companyDocuments.uploadedBy, userId), inArray(companyDocuments.id, permittedIds))
        : eq(companyDocuments.uploadedBy, userId)
    );

    const visibilityCondition = or(eq(companyDocuments.accessType, ACCESS.PUBLIC), restrictedVisibility);

    const conditions = [visibilityCondition];

    if (q) {
      conditions.push(ilike(companyDocuments.title, `%${escapeLikePattern(q)}%`));
    }
    if (category) {
      conditions.push(eq(companyDocuments.category, category));
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: companyDocuments.id,
        title: companyDocuments.title,
        category: companyDocuments.category,
        fileUrl: companyDocuments.fileUrl,
        fileSize: companyDocuments.fileSize,
        accessType: companyDocuments.accessType,
        uploadedBy: companyDocuments.uploadedBy,
        createdAt: companyDocuments.createdAt,
        updatedAt: companyDocuments.updatedAt,
        uploaderName: users.name,
      })
      .from(companyDocuments)
      .innerJoin(users, eq(companyDocuments.uploadedBy, users.id))
      .where(whereClause)
      .orderBy(desc(companyDocuments.createdAt));

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = companyDocumentsSchemaHint(e);
    console.error("[GET /api/company-documents]", msg);
    return NextResponse.json(
      {
        error: hint ?? msg,
        hint: hint ?? undefined,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}

/** POST: multipart 上傳並建立企業文檔 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "無法解析表單" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "請選擇檔案" }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "請輸入標題" }, { status: 400 });
  }

  const category = String(formData.get("category") ?? "").trim();
  if (!category) {
    return NextResponse.json({ error: "請選擇或輸入分類" }, { status: 400 });
  }

  const accessTypeRaw = String(formData.get("access_type") ?? ACCESS.PUBLIC).trim().toUpperCase();
  const accessType =
    accessTypeRaw === ACCESS.RESTRICTED ? ACCESS.RESTRICTED : ACCESS.PUBLIC;

  try {
    const db = getDb();
    const storageKey = randomUUID();
    const fileName = file.name || "upload.bin";
    const mockFileUrl = `https://mock-storage.example.com/company-docs/${storageKey}/${encodeURIComponent(fileName)}`;
    const fileSize =
      typeof file.size === "number" ? Math.min(Math.max(file.size, 0), 2_147_483_647) : 0;

    const [row] = await db
      .insert(companyDocuments)
      .values({
        title,
        category,
        fileUrl: mockFileUrl,
        fileSize,
        accessType,
        uploadedBy: session.user.id,
      })
      .returning();

    if (!row) {
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/company-documents]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
