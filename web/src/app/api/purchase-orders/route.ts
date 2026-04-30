import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const sql = getNeonSql();
    const rows = await sql.query(
      `SELECT po.*,
        (SELECT COUNT(*)::int FROM purchase_order_receipts r WHERE r.purchase_order_id = po.id) AS receipt_line_count
       FROM purchase_orders po
       ORDER BY po.po_date DESC NULLS LAST, po.created_at DESC NULLS LAST, po.po_no ASC`
    );
    return NextResponse.json({ items: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /purchase_orders|purchase_order_receipts|column|does not exist/i.test(msg)
        ? "請執行 npm run db:apply:documents-init"
        : undefined;
    console.error("[GET /api/purchase-orders]", msg);
    return NextResponse.json(
      {
        error: "無法讀取採購單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}
