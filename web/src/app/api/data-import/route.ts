import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import { canEditSettings } from "@/lib/authz";
import {
  dataImportRequestSchema,
  validateImportRow,
  type DataImportType,
} from "@/lib/validations/data-import";

export const runtime = "nodejs";

function persistImportRows(
  sql: ReturnType<typeof getNeonSql>,
  importType: DataImportType,
  batchId: string,
  validatedRows: Record<string, string>[]
) {
  const indices = validatedRows.map((_, i) => i);
  const jsonStrings = validatedRows.map((r) => JSON.stringify(r));
  return sql.query(
    `INSERT INTO data_import_staging (import_type, batch_id, row_index, record)
     SELECT $1::text, $2::uuid, u.i, u.r::jsonb
     FROM unnest($3::integer[], $4::text[]) AS u(i, r)`,
    [importType, batchId, indices, jsonStrings]
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditSettings(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = dataImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const { importType, rows } = parsed.data;
  const rowErrors: { row: number; message: string }[] = [];
  const validatedRows: Record<string, string>[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    let result: ReturnType<typeof validateImportRow>;
    switch (importType) {
      case "QUOTATION":
        result = validateImportRow("QUOTATION", rows[i]!, rowNumber);
        break;
      case "PO":
        result = validateImportRow("PO", rows[i]!, rowNumber);
        break;
      case "INVENTORY":
        result = validateImportRow("INVENTORY", rows[i]!, rowNumber);
        break;
      default: {
        const _exhaustive: never = importType;
        return NextResponse.json({ error: `不支援的 importType：${_exhaustive}` }, { status: 400 });
      }
    }
    if (!result.ok) {
      rowErrors.push(result.error);
    } else {
      validatedRows.push(result.data);
    }
  }

  if (rowErrors.length > 0) {
    return NextResponse.json(
      { ok: false, error: "部分列未通過驗證", errors: rowErrors },
      { status: 400 }
    );
  }

  const batchId = randomUUID();

  try {
    const sql = getNeonSql();
    await persistImportRows(sql, importType, batchId, validatedRows);
    return NextResponse.json({
      ok: true,
      importType,
      batchId,
      inserted: validatedRows.length,
      message:
        "資料已寫入匯入暫存表 data_import_staging；報價／採購／庫存正式業務表於後續模塊對接後可由此批次轉入。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /data_import_staging|column|does not exist/i.test(msg)
        ? "請確認已建立 data_import_staging 表（見 web/sql/employee_settings_init.sql）"
        : undefined;
    console.error("[POST /api/data-import]", msg);
    return NextResponse.json(
      {
        error: "批量寫入失敗",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}
