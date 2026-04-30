import { and, asc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const runtime = "nodejs";

function escapeLikePattern(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** GET：搜尋可授權的內部帳號（users） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;

  try {
    const db = getDb();
    const conditions = [eq(users.isActive, true)];

    if (q) {
      const pat = `%${escapeLikePattern(q)}%`;
      conditions.push(or(ilike(users.name, pat), ilike(users.email, pat))!);
    }

    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(asc(users.name))
      .limit(limit);

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/company-documents/users]", msg);
    return NextResponse.json(
      { error: msg, detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
