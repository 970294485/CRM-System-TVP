import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { serviceResourceVenues } from "@/db/schema";
import { serviceVenuePatchSchema } from "@/lib/validations/service-resource-booking";

export const runtime = "nodejs";

const uuidParam = z.string().uuid();

function missingTableHint(msg: string): string | undefined {
  if (/service_resource_venues|relation|does not exist/i.test(msg)) {
    return "請在 web 目錄執行：npm run db:apply:service-resource-booking-init";
  }
  return undefined;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const idParsed = uuidParam.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的編號" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = serviceVenuePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "無可更新欄位" }, { status: 400 });
  }

  try {
    const db = getDb();
    const d = parsed.data;
    const [row] = await db
      .update(serviceResourceVenues)
      .set({
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.venueType !== undefined ? { venueType: d.venueType } : {}),
        ...(d.capacity !== undefined ? { capacity: d.capacity } : {}),
        ...(d.locationNote !== undefined ? { locationNote: d.locationNote?.trim() || null } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(serviceResourceVenues.id, idParsed.data))
      .returning({ id: serviceResourceVenues.id });

    if (!row) {
      return NextResponse.json({ error: "找不到場地" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingTableHint(msg);
    console.error("[PATCH /api/service-management/venues/[id]]", msg);
    return NextResponse.json(
      {
        error: hint ?? "更新失敗",
        hint,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
