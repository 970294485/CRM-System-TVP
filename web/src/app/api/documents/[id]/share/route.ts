import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { systemDocumentPersonalShares, systemDocuments, users } from "@/db/schema";
import { isPersonalDriveOwner, PERSONAL_DRIVE_ENTITY_TYPE } from "@/lib/personal-drive";

export const runtime = "nodejs";

const postBodySchema = z.object({
  shared_with_user_id: z.string().uuid(),
  permission: z.enum(["view", "download"]),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: docId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(docId)) {
    return NextResponse.json({ error: "無效的檔案 ID" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const [doc] = await db.select().from(systemDocuments).where(eq(systemDocuments.id, docId)).limit(1);
    if (!doc) {
      return NextResponse.json({ error: "找不到檔案" }, { status: 404 });
    }
    if (
      doc.entityType !== PERSONAL_DRIVE_ENTITY_TYPE ||
      !isPersonalDriveOwner(doc.entityType, doc.entityId, session.user.id)
    ) {
      return NextResponse.json({ error: "僅個人網盤擁有者可檢視分享名單" }, { status: 403 });
    }

    const rows = await db
      .select({
        id: systemDocumentPersonalShares.id,
        sharedWithUserId: systemDocumentPersonalShares.sharedWithUserId,
        permission: systemDocumentPersonalShares.permission,
        createdAt: systemDocumentPersonalShares.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(systemDocumentPersonalShares)
      .innerJoin(users, eq(systemDocumentPersonalShares.sharedWithUserId, users.id))
      .where(eq(systemDocumentPersonalShares.documentId, docId))
      .orderBy(asc(users.name));

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /system_document_personal_shares|does not exist/i.test(msg)
        ? "資料表可能尚未建立。請執行 npm run db:apply:personal-shares-init"
        : undefined;
    console.error("[GET /api/documents/:id/share]", msg);
    return NextResponse.json(
      {
        error: "無法讀取分享",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: docId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(docId)) {
    return NextResponse.json({ error: "無效的檔案 ID" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數錯誤", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { shared_with_user_id: targetUserId, permission } = parsed.data;
  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "不可分享給自己" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [doc] = await db.select().from(systemDocuments).where(eq(systemDocuments.id, docId)).limit(1);
    if (!doc) {
      return NextResponse.json({ error: "找不到檔案" }, { status: 404 });
    }
    if (
      doc.entityType !== PERSONAL_DRIVE_ENTITY_TYPE ||
      !isPersonalDriveOwner(doc.entityType, doc.entityId, session.user.id)
    ) {
      return NextResponse.json({ error: "僅個人網盤擁有者可分享檔案" }, { status: 403 });
    }

    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, targetUserId), eq(users.isActive, true)))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: "找不到有效的使用者" }, { status: 400 });
    }

    await db
      .insert(systemDocumentPersonalShares)
      .values({
        documentId: docId,
        sharedByUserId: session.user.id,
        sharedWithUserId: targetUserId,
        permission,
      })
      .onConflictDoUpdate({
        target: [
          systemDocumentPersonalShares.documentId,
          systemDocumentPersonalShares.sharedWithUserId,
        ],
        set: {
          permission: sql`excluded.permission`,
          sharedByUserId: sql`excluded.shared_by_user_id`,
        },
      });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /system_document_personal_shares|does not exist/i.test(msg)
        ? "資料表可能尚未建立。請執行 npm run db:apply:personal-shares-init"
        : undefined;
    console.error("[POST /api/documents/:id/share]", msg);
    return NextResponse.json(
      {
        error: "分享失敗",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: docId } = await context.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(docId)) {
    return NextResponse.json({ error: "無效的檔案 ID" }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const targetUserId = new URL(request.url).searchParams.get("user_id")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
    return NextResponse.json({ error: "請提供有效的 user_id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [doc] = await db.select().from(systemDocuments).where(eq(systemDocuments.id, docId)).limit(1);
    if (!doc) {
      return NextResponse.json({ error: "找不到檔案" }, { status: 404 });
    }
    if (
      doc.entityType !== PERSONAL_DRIVE_ENTITY_TYPE ||
      !isPersonalDriveOwner(doc.entityType, doc.entityId, session.user.id)
    ) {
      return NextResponse.json({ error: "僅個人網盤擁有者可取消分享" }, { status: 403 });
    }

    await db
      .delete(systemDocumentPersonalShares)
      .where(
        and(
          eq(systemDocumentPersonalShares.documentId, docId),
          eq(systemDocumentPersonalShares.sharedWithUserId, targetUserId)
        )
      );

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/documents/:id/share]", msg);
    return NextResponse.json(
      { error: "取消分享失敗", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
