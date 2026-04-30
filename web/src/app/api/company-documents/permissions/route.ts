import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { companyDocumentPermissions, companyDocuments, users } from "@/db/schema";
import { canAssignCompanyDocumentPermissions } from "@/lib/authz";

export const runtime = "nodejs";

const bodySchema = z.object({
  document_id: z.string().uuid(),
  user_ids: z.array(z.string().uuid()),
});

/** GET：取得某文檔目前已授權的 user_id（僅管理員／上傳者可查） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const documentId = new URL(request.url).searchParams.get("document_id")?.trim() ?? "";
  if (!z.string().uuid().safeParse(documentId).success) {
    return NextResponse.json({ error: "document_id 須為有效 UUID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [doc] = await db
      .select()
      .from(companyDocuments)
      .where(eq(companyDocuments.id, documentId))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "文檔不存在" }, { status: 404 });
    }

    if (!canAssignCompanyDocumentPermissions(session, doc.uploadedBy)) {
      return NextResponse.json({ error: "無權限檢視此文檔授權" }, { status: 403 });
    }

    const rows = await db
      .select({
        userId: companyDocumentPermissions.userId,
        name: users.name,
        email: users.email,
      })
      .from(companyDocumentPermissions)
      .innerJoin(users, eq(companyDocumentPermissions.userId, users.id))
      .where(eq(companyDocumentPermissions.documentId, documentId));

    return NextResponse.json({
      document_id: documentId,
      user_ids: rows.map((r) => r.userId),
      users: rows.map((r) => ({ id: r.userId, name: r.name, email: r.email })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/company-documents/permissions]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數錯誤", detail: parsed.error.flatten() }, { status: 400 });
  }

  const { document_id, user_ids } = parsed.data;
  const uniqueUserIds = [...new Set(user_ids)];

  try {
    const db = getDb();
    const [doc] = await db
      .select()
      .from(companyDocuments)
      .where(eq(companyDocuments.id, document_id))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "文檔不存在" }, { status: 404 });
    }

    if (doc.accessType !== "RESTRICTED") {
      return NextResponse.json({ error: "僅限內部受限文檔可分配權限" }, { status: 400 });
    }

    if (!canAssignCompanyDocumentPermissions(session, doc.uploadedBy)) {
      return NextResponse.json({ error: "無權限分配此文檔" }, { status: 403 });
    }

    if (uniqueUserIds.length) {
      const existingUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.isActive, true), inArray(users.id, uniqueUserIds)));

      const found = new Set(existingUsers.map((u) => u.id));
      const missing = uniqueUserIds.filter((id) => !found.has(id));
      if (missing.length) {
        return NextResponse.json({ error: "部分使用者不存在或已停用", missing }, { status: 400 });
      }
    }

    await db.delete(companyDocumentPermissions).where(eq(companyDocumentPermissions.documentId, document_id));

    if (uniqueUserIds.length) {
      await db.insert(companyDocumentPermissions).values(
        uniqueUserIds.map((userId) => ({
          documentId: document_id,
          userId,
        }))
      );
    }

    return NextResponse.json({ ok: true, document_id, granted_count: uniqueUserIds.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/company-documents/permissions]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
