import { asc, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { quotations } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const rawCustomerId = req.nextUrl.searchParams.get("customerId");
  const customerIdParsed = rawCustomerId
    ? z.string().uuid().safeParse(rawCustomerId)
    : { success: true as const, data: undefined as string | undefined };
  if (!customerIdParsed.success) {
    return NextResponse.json({ error: "customerId 須為有效 UUID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const order = [desc(quotations.quoteDate), asc(quotations.quoteNo)] as const;
    const rows =
      customerIdParsed.data !== undefined
        ? await db
            .select()
            .from(quotations)
            .where(eq(quotations.customerId, customerIdParsed.data))
            .orderBy(...order)
        : await db.select().from(quotations).orderBy(...order);
    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      /quotations|column|does not exist/i.test(msg)
        ? "請執行 npm run db:apply:documents-init"
        : undefined;
    console.error("[GET /api/quotations]", msg);
    return NextResponse.json(
      {
        error: "無法讀取報價單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint,
      },
      { status: 500 }
    );
  }
}
