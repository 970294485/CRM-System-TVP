import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { roles } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";

export const runtime = "nodejs";

/** 編審批策略時下拉的模組 9 角色 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ id: roles.id, slug: roles.slug, name: roles.name })
      .from(roles)
      .orderBy(asc(roles.slug));
    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/finance/approval-roles]", msg);
    return NextResponse.json(
      { error: "無法讀取角色", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
