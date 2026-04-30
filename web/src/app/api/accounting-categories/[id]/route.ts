import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import { canEditFinance } from "@/lib/authz";
import { ptAccountingCategoryUpdateSchema } from "@/lib/validations/pt-accounting-category";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  }

  try {
    const sql = getNeonSql();
    const rows = await sql.query(`SELECT * FROM accounting_categories WHERE id = $1 LIMIT 1`, [id]);
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "找不到科目" }, { status: 404 });
    }
    return NextResponse.json({ item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/accounting-categories/[id]]", msg);
    return NextResponse.json({ error: "讀取失敗", detail: process.env.NODE_ENV !== "production" ? msg : undefined }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !canEditFinance(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = ptAccountingCategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const d = parsed.data;
  const description = d.description?.trim() ? d.description.trim() : null;
  const sortOrder = d.sort_order;

  try {
    const sql = getNeonSql();
    const existingRows = await sql.query(`SELECT id FROM accounting_categories WHERE id = $1 LIMIT 1`, [id]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
    if (!existing) {
      return NextResponse.json({ error: "找不到科目" }, { status: 404 });
    }

    const rows = await sql.query(
      sortOrder !== undefined
        ? `UPDATE accounting_categories SET
            category_code = $2,
            category_name = $3,
            account_type = $4,
            description = $5,
            is_active = $6,
            sort_order = $7,
            updated_at = now()
          WHERE id = $1
          RETURNING *`
        : `UPDATE accounting_categories SET
            category_code = $2,
            category_name = $3,
            account_type = $4,
            description = $5,
            is_active = $6,
            updated_at = now()
          WHERE id = $1
          RETURNING *`,
      sortOrder !== undefined
        ? [id, d.category_code, d.category_name, d.account_type, description, d.is_active, sortOrder]
        : [id, d.category_code, d.category_name, d.account_type, description, d.is_active]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "更新失敗" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "科目代碼與其他筆重複" }, { status: 409 });
    }
    if (/check|constraint/i.test(msg.toLowerCase())) {
      return NextResponse.json({ error: "資料不符合資料庫限制" }, { status: 400 });
    }
    console.error("[PATCH /api/accounting-categories/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !canEditFinance(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  }

  try {
    const sql = getNeonSql();
    const countRows = await sql.query(
      `SELECT count(*)::int AS n FROM accounting_items WHERE category_id = $1`,
      [id]
    );
    const n = Array.isArray(countRows) && countRows[0] ? Number((countRows[0] as { n: number }).n) : 0;
    if (n > 0) {
      return NextResponse.json(
        { error: `此類別下仍有 ${n} 筆入賬項目，請先在「入賬類別與項目」處理後再刪除。` },
        { status: 409 }
      );
    }

    const del = await sql.query(`DELETE FROM accounting_categories WHERE id = $1 RETURNING id`, [id]);
    if (!Array.isArray(del) || del.length === 0) {
      return NextResponse.json({ error: "找不到科目" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/accounting-categories/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
