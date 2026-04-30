import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";
import { canEditSettings } from "@/lib/authz";
import { employeeSettingsCreateSchema } from "@/lib/validations/employee-settings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const sql = getNeonSql();
    const rows = await sql.query(
      `SELECT * FROM employee_settings ORDER BY employee_name ASC, created_at ASC`
    );
    return NextResponse.json({ items: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /employee_settings|column|does not exist/i.test(msg)
        ? "資料表可能尚未建立。請在 Neon 執行 web/sql/employee_settings_init.sql，或於 web 目錄執行：npm run db:migrate"
        : undefined;
    console.error("[GET /api/employee-settings]", msg);
    return NextResponse.json(
      {
        error: "無法讀取員工設置",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
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

  const parsed = employeeSettingsCreateSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("；");
    return NextResponse.json({ error: msg || "驗證失敗" }, { status: 400 });
  }

  const d = parsed.data;
  const department = d.department?.trim() ? d.department.trim() : null;

  try {
    const sql = getNeonSql();
    const rows = await sql.query(
      `INSERT INTO employee_settings (
        employee_name, department, base_salary, commission_rate,
        work_start_time, work_end_time, is_active
      ) VALUES ($1, $2, $3::numeric, $4::numeric, $5::time, $6::time, $7)
      RETURNING *`,
      [
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
      return NextResponse.json({ error: "寫入失敗" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /employee_settings|column|does not exist/i.test(msg)
        ? "請確認已建立 employee_settings 表（見 web/sql/employee_settings_init.sql）"
        : undefined;
    console.error("[POST /api/employee-settings]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined, hint },
      { status: 500 }
    );
  }
}
