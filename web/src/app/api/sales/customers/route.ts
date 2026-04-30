import { desc, eq, ilike, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers } from "@/db/schema";

export const runtime = "nodejs";

/** 報價單客戶 Combobox：依名稱／編碼／聯絡搜尋 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const idParam = (req.nextUrl.searchParams.get("id") ?? "").trim();
  const idParsed = idParam ? z.string().uuid().safeParse(idParam) : { success: false as const };
  const rawLimit = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Math.min(80, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 30));

  try {
    const db = getDb();
    if (idParsed.success) {
      const [one] = await db
        .select({
          id: customers.id,
          name: customers.name,
          customerCode: customers.customerCode,
          contactName: customers.contactName,
          phone: customers.phone,
          email: customers.email,
          address: customers.address,
        })
        .from(customers)
        .where(eq(customers.id, idParsed.data))
        .limit(1);
      return NextResponse.json({ items: one ? [one] : [] });
    }

    const pattern = `%${q}%`;
    const base = db
      .select({
        id: customers.id,
        name: customers.name,
        customerCode: customers.customerCode,
        contactName: customers.contactName,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
      })
      .from(customers);

    const rows = q
      ? await base
          .where(
            or(
              ilike(customers.name, pattern),
              ilike(customers.customerCode, pattern),
              ilike(customers.contactName, pattern),
              ilike(customers.phone, pattern),
              ilike(customers.email, pattern)
            )
          )
          .orderBy(desc(customers.updatedAt))
          .limit(limit)
      : await base.orderBy(desc(customers.updatedAt)).limit(limit);

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sales/customers]", msg);
    return NextResponse.json(
      { error: "無法讀取客戶", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
