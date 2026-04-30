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
      `SELECT i.*,
        (SELECT COUNT(*)::int FROM purchase_order_receipts r
         WHERE r.product_id = i.product_id
           AND (r.warehouse_location IS NOT DISTINCT FROM i.warehouse_location)) AS receipt_link_count
       FROM inventory i
       ORDER BY i.sku ASC, i.warehouse_location ASC NULLS LAST`
    );
    return NextResponse.json({ items: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /inventory|purchase_order_receipts|column|does not exist/i.test(msg)
        ? "請執行 npm run db:apply:documents-init"
        : undefined;
    console.error("[GET /api/inventory]", msg);
    return NextResponse.json(
      {
        error: "無法讀取庫存",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}
