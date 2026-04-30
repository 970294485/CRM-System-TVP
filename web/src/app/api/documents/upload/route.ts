import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { documentCategories, systemDocuments } from "@/db/schema";
import { canManageDocuments } from "@/lib/authz";
import { CRM_LOCAL_FILE_URL_PREFIX, getSystemDocumentUploadDir } from "@/lib/personal-drive";
import { parseOptionalEntityId } from "@/lib/validations/document-classification";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canManageDocuments(session)) {
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

  const categoryIdRaw = String(formData.get("category_id") ?? "").trim();
  if (!categoryIdRaw) {
    return NextResponse.json({ error: "請選擇分類" }, { status: 400 });
  }

  const entityTypeRaw = String(formData.get("entity_type") ?? "").trim();
  const entityType = entityTypeRaw || null;

  const entityIdParsed = parseOptionalEntityId(String(formData.get("entity_id") ?? ""));
  const entityId = entityType ? entityIdParsed : null;

  try {
    const db = getDb();
    const [cat] = await db
      .select({ id: documentCategories.id })
      .from(documentCategories)
      .where(eq(documentCategories.id, categoryIdRaw))
      .limit(1);

    if (!cat) {
      return NextResponse.json({ error: "分類不存在" }, { status: 400 });
    }

    const storageKey = randomUUID();
    const uploadDir = getSystemDocumentUploadDir();
    await mkdir(uploadDir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(join(uploadDir, storageKey), buf);
    const fileUrl = `${CRM_LOCAL_FILE_URL_PREFIX}${storageKey}`;

    const fileName = file.name || "upload.bin";
    const mimeType = file.type?.trim() ? file.type.trim() : null;
    const fileSize = typeof file.size === "number" ? Math.min(Math.max(file.size, 0), 2_147_483_647) : 0;

    const [row] = await db
      .insert(systemDocuments)
      .values({
        fileName,
        fileUrl,
        categoryId: categoryIdRaw,
        entityType,
        entityId,
        fileSize,
        mimeType,
      })
      .returning();

    if (!row) {
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/documents/upload]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
