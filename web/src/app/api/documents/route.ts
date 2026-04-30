import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { documentCategories, systemDocumentPersonalShares, systemDocuments, users } from "@/db/schema";
import { parseOptionalEntityId } from "@/lib/validations/document-classification";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("category_id")?.trim() || undefined;
  const entityType = searchParams.get("entity_type")?.trim() || undefined;
  const entityIdParam = searchParams.get("entity_id")?.trim() || undefined;
  const sharedWithMeRaw = (searchParams.get("shared_with_me") ?? "").trim().toLowerCase();
  const sharedWithMe = ["1", "true", "yes"].includes(sharedWithMeRaw);

  let entityId: string | undefined;
  if (entityIdParam) {
    const parsed = parseOptionalEntityId(entityIdParam);
    if (!parsed) {
      return NextResponse.json({ error: "entity_id 須為有效 UUID" }, { status: 400 });
    }
    entityId = parsed;
  }

  try {
    const db = getDb();

    if (sharedWithMe) {
      const conds = [eq(systemDocumentPersonalShares.sharedWithUserId, session.user.id)];
      if (categoryId) {
        conds.push(eq(systemDocuments.categoryId, categoryId));
      }
      const rows = await db
        .select({
          id: systemDocuments.id,
          fileName: systemDocuments.fileName,
          fileUrl: systemDocuments.fileUrl,
          categoryId: systemDocuments.categoryId,
          categoryName: documentCategories.name,
          entityType: systemDocuments.entityType,
          entityId: systemDocuments.entityId,
          fileSize: systemDocuments.fileSize,
          mimeType: systemDocuments.mimeType,
          createdAt: systemDocuments.createdAt,
          sharePermission: systemDocumentPersonalShares.permission,
          sharedByUserId: systemDocumentPersonalShares.sharedByUserId,
          sharedByName: users.name,
          sharedByEmail: users.email,
          sharedAt: systemDocumentPersonalShares.createdAt,
        })
        .from(systemDocumentPersonalShares)
        .innerJoin(systemDocuments, eq(systemDocumentPersonalShares.documentId, systemDocuments.id))
        .innerJoin(documentCategories, eq(systemDocuments.categoryId, documentCategories.id))
        .innerJoin(users, eq(systemDocumentPersonalShares.sharedByUserId, users.id))
        .where(and(...conds))
        .orderBy(desc(systemDocumentPersonalShares.createdAt));

      return NextResponse.json({ items: rows });
    }

    const conditions = [];
    if (categoryId) {
      conditions.push(eq(systemDocuments.categoryId, categoryId));
    }
    if (entityType) {
      conditions.push(eq(systemDocuments.entityType, entityType));
    }
    if (entityId) {
      conditions.push(eq(systemDocuments.entityId, entityId));
    }
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const base = db
      .select({
        id: systemDocuments.id,
        fileName: systemDocuments.fileName,
        fileUrl: systemDocuments.fileUrl,
        categoryId: systemDocuments.categoryId,
        categoryName: documentCategories.name,
        entityType: systemDocuments.entityType,
        entityId: systemDocuments.entityId,
        fileSize: systemDocuments.fileSize,
        mimeType: systemDocuments.mimeType,
        createdAt: systemDocuments.createdAt,
      })
      .from(systemDocuments)
      .innerJoin(documentCategories, eq(systemDocuments.categoryId, documentCategories.id));

    const rows = whereClause
      ? await base.where(whereClause).orderBy(desc(systemDocuments.createdAt))
      : await base.orderBy(desc(systemDocuments.createdAt));

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /system_documents|document_categories|does not exist/i.test(msg)
        ? "資料表可能尚未建立。請執行 web/sql/document_classification_init.sql，或 npm run db:migrate"
        : undefined;
    console.error("[GET /api/documents]", msg);
    return NextResponse.json(
      { error: "無法讀取文件列表", detail: process.env.NODE_ENV !== "production" ? msg : undefined, hint },
      { status: 500 }
    );
  }
}
