import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import { canEditFinance } from "@/lib/authz";
import { ptAccountingCategoryCreateSchema } from "@/lib/validations/pt-accounting-category";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const sql = getNeonSql();
    const rows = await sql.query(
      `SELECT * FROM accounting_categories ORDER BY account_type ASC, category_code ASC`
    );
    return NextResponse.json({ items: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /account_type|category_code|column|does not exist/i.test(msg)
        ? "資料表可能尚未執行 migration 0007（合併 accounting_categories）。請在 web 目錄執行：npm run db:migrate"
        : undefined;
    console.error("[GET /api/accounting-categories]", msg);
    return NextResponse.json(
      {
        error: "無法讀取會計科目",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !canEditFinance(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = ptAccountingCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const d = parsed.data;
  const description = d.description?.trim() ? d.description.trim() : null;
  const sortOrder = d.sort_order ?? 0;

  try {
    const sql = getNeonSql();
    const rows = await sql.query(
      `INSERT INTO accounting_categories (
        category_code, category_name, account_type, description, is_active, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [d.category_code, d.category_name, d.account_type, description, d.is_active ?? true, sortOrder]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "科目代碼已存在" }, { status: 409 });
    }
    if (/check|constraint/i.test(msg.toLowerCase())) {
      return NextResponse.json({ error: "資料不符合資料庫限制（例如會計類別）" }, { status: 400 });
    }
    const hint =
      /account_type|category_code|column|does not exist/i.test(msg)
        ? "請確認已執行 npm run db:migrate（含 0007_merge_accounting_categories）"
        : undefined;
    console.error("[POST /api/accounting-categories]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined, hint },
      { status: 500 }
    );
  }
}
