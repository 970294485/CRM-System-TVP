import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { serviceResourceVenues } from "@/db/schema";
import { serviceVenueCreateSchema } from "@/lib/validations/service-resource-booking";

export const runtime = "nodejs";

function missingTableHint(msg: string): string | undefined {
  if (/service_resource_venues|relation|does not exist/i.test(msg)) {
    return "請在 web 目錄執行：npm run db:apply:service-resource-booking-init";
  }
  return undefined;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: serviceResourceVenues.id,
        name: serviceResourceVenues.name,
        venueType: serviceResourceVenues.venueType,
        capacity: serviceResourceVenues.capacity,
        locationNote: serviceResourceVenues.locationNote,
        isActive: serviceResourceVenues.isActive,
        updatedAt: serviceResourceVenues.updatedAt,
      })
      .from(serviceResourceVenues)
      .orderBy(asc(serviceResourceVenues.name));

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingTableHint(msg);
    console.error("[GET /api/service-management/venues]", msg);
    return NextResponse.json(
      {
        error: hint ?? "讀取場地失敗",
        hint,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const parsed = serviceVenueCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .insert(serviceResourceVenues)
      .values({
        name: parsed.data.name,
        venueType: parsed.data.venueType,
        capacity: parsed.data.capacity ?? null,
        locationNote: parsed.data.locationNote?.trim() || null,
      })
      .returning({
        id: serviceResourceVenues.id,
        name: serviceResourceVenues.name,
        venueType: serviceResourceVenues.venueType,
        capacity: serviceResourceVenues.capacity,
        locationNote: serviceResourceVenues.locationNote,
        isActive: serviceResourceVenues.isActive,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingTableHint(msg);
    console.error("[POST /api/service-management/venues]", msg);
    return NextResponse.json(
      {
        error: hint ?? "建立場地失敗",
        hint,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
