import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { deliveryNotes } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的送貨單 id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db.select().from(deliveryNotes).where(eq(deliveryNotes.id, idParsed.data)).limit(1);
    if (!row) {
      return NextResponse.json({ error: "找不到送貨單" }, { status: 404 });
    }

    const item = {
      id: row.id,
      dnNo: row.dnNo,
      contractId: row.contractId,
      sourceContractNo: row.sourceContractNo,
      customerId: row.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
      customerEmail: row.customerEmail,
      shipToAddress: row.shipToAddress,
      shipDate: row.shipDate,
      items: row.items,
      notes: row.notes,
      status: row.status,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };

    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sales/delivery-notes/[id]]", msg);
    return NextResponse.json(
      {
        error: "無法讀取送貨單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /delivery_notes|does not exist/i.test(msg) ? "請執行 npm run db:apply:delivery-notes" : undefined,
      },
      { status: 500 }
    );
  }
}
