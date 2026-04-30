import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getNeonSql } from "@/db";

export const runtime = "nodejs";

type RawRow = {
  id: string;
  product_id: string;
  sku: string;
  qty_received: number;
  warehouse_location: string | null;
  unit_cost: string | null;
  line_name_snapshot: string | null;
  received_at: string;
};

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "採購單 id 須為有效 UUID" }, { status: 400 });
  }

  try {
    const sql = getNeonSql();
    const rows = await sql.query(
      `SELECT r.id, r.product_id::text AS product_id, r.sku, r.qty_received,
              r.warehouse_location, r.unit_cost::text AS unit_cost, r.line_name_snapshot,
              r.received_at::text AS received_at
       FROM purchase_order_receipts r
       WHERE r.purchase_order_id = $1::uuid
       ORDER BY r.received_at DESC NULLS LAST, r.id ASC`,
      [idParsed.data]
    );
    const list = Array.isArray(rows) ? (rows as RawRow[]) : [];
    const items = list.map((r) => ({
      id: r.id,
      productId: r.product_id,
      sku: r.sku,
      qtyReceived: r.qty_received,
      warehouseLocation: r.warehouse_location,
      unitCost: r.unit_cost,
      lineNameSnapshot: r.line_name_snapshot,
      receivedAt: r.received_at,
    }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/purchase-orders/[id]/receipts]", msg);
    return NextResponse.json(
      {
        error: "無法讀取採購入庫明細",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /purchase_order_receipts|does not exist/i.test(msg)
          ? "請執行 npm run db:apply:documents-init"
          : undefined,
      },
      { status: 500 }
    );
  }
}
