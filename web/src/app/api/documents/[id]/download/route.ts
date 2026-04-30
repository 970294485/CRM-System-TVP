import { readFile } from "fs/promises";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { systemDocumentPersonalShares, systemDocuments } from "@/db/schema";
import {
  isLegacyMockFileUrl,
  isPersonalDriveOwner,
  parseCrmLocalStorageKey,
  PERSONAL_DRIVE_ENTITY_TYPE,
  getLocalDocumentAbsolutePath,
} from "@/lib/personal-drive";

export const runtime = "nodejs";

function contentDisposition(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

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
  const uid = session.user.id;

  try {
    const db = getDb();
    const [doc] = await db.select().from(systemDocuments).where(eq(systemDocuments.id, docId)).limit(1);

    if (!doc) {
      return NextResponse.json({ error: "找不到檔案" }, { status: 404 });
    }

    if (doc.entityType === PERSONAL_DRIVE_ENTITY_TYPE) {
      if (!isPersonalDriveOwner(doc.entityType, doc.entityId, uid)) {
        const [share] = await db
          .select({ permission: systemDocumentPersonalShares.permission })
          .from(systemDocumentPersonalShares)
          .where(
            and(
              eq(systemDocumentPersonalShares.documentId, docId),
              eq(systemDocumentPersonalShares.sharedWithUserId, uid)
            )
          )
          .limit(1);
        if (!share) {
          return NextResponse.json({ error: "無權限下載此檔案" }, { status: 403 });
        }
        if (share.permission === "view") {
          return NextResponse.json({ error: "此分享僅限檢視，無法下載" }, { status: 403 });
        }
      }
    }

    const fileName = doc.fileName || "download";
    const mime = doc.mimeType?.trim() || "application/octet-stream";

    const key = parseCrmLocalStorageKey(doc.fileUrl);
    if (key) {
      try {
        const buf = await readFile(getLocalDocumentAbsolutePath(key));
        return new NextResponse(buf, {
          headers: {
            "Content-Type": mime,
            "Content-Disposition": contentDisposition(fileName),
          },
        });
      } catch {
        return NextResponse.json({ error: "實體檔案不存在或無法讀取" }, { status: 404 });
      }
    }

    if (isLegacyMockFileUrl(doc.fileUrl)) {
      const text = `（歷史示範資料）上傳時未儲存實體內容，無法還原二進位檔。\n檔名：${fileName}\n`;
      const body = new TextEncoder().encode(text);
      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": contentDisposition(`${fileName}.說明.txt`),
        },
      });
    }

    return NextResponse.json(
      { error: "此檔案未使用本機儲存，無法由此下載" },
      { status: 501 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/documents/:id/download]", msg);
    return NextResponse.json(
      { error: "下載失敗", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
