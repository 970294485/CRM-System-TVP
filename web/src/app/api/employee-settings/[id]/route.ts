import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import { canEditSettings } from "@/lib/authz";
import { employeeSettingsUpdateSchema } from "@/lib/validations/employee-settings";

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
    const rows = await sql.query(`SELECT * FROM employee_settings WHERE id = $1 LIMIT 1`, [id]);
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "找不到員工設置" }, { status: 404 });
    }
    return NextResponse.json({ item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/employee-settings/[id]]", msg);
    return NextResponse.json(
      { error: "讀取失敗", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !canEditSettings(session)) {
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

  const parsed = employeeSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const d = parsed.data;
  const department = d.department?.trim() ? d.department.trim() : null;

  try {
    const sql = getNeonSql();
    const existingRows = await sql.query(`SELECT id FROM employee_settings WHERE id = $1 LIMIT 1`, [id]);
    const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0] : null;
    if (!existing) {
      return NextResponse.json({ error: "找不到員工設置" }, { status: 404 });
    }

    const rows = await sql.query(
      `UPDATE employee_settings SET
        employee_name = $2,
        department = $3,
        base_salary = $4::numeric,
        commission_rate = $5::numeric,
        work_start_time = $6::time,
        work_end_time = $7::time,
        is_active = $8,
        updated_at = now()
      WHERE id = $1
      RETURNING *`,
      [
        id,
        d.employee_name,
        department,
        d.base_salary,
        d.commission_rate,
        d.work_start_time,
        d.work_end_time,
        d.is_active ?? true,
      ]
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return NextResponse.json({ error: "更新失敗" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/employee-settings/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id || !canEditSettings(session)) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "無效的 id" }, { status: 400 });
  }

  try {
    const sql = getNeonSql();
    const del = await sql.query(`DELETE FROM employee_settings WHERE id = $1 RETURNING id`, [id]);
    if (!Array.isArray(del) || del.length === 0) {
      return NextResponse.json({ error: "找不到員工設置" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/employee-settings/[id]]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
