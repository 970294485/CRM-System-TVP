import { and, desc, eq, gte, gt, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  customerServiceCases,
  serviceResourceBookings,
  serviceResourceVenues,
  users,
} from "@/db/schema";
import { serviceResourceBookingCreateSchema } from "@/lib/validations/service-resource-booking";

export const runtime = "nodejs";

function missingTableHint(msg: string): string | undefined {
  if (
    /service_resource_bookings|service_resource_venues|customer_service_cases|relation|does not exist/i.test(
      msg
    )
  ) {
    return "請在 web 目錄依序執行：npm run db:apply:customer-service-init → npm run db:apply:service-resource-booking-init";
  }
  return undefined;
}

async function findStaffConflict(db: ReturnType<typeof getDb>, staffUserId: string, start: Date, end: Date) {
  const rows = await db
    .select({ id: serviceResourceBookings.id })
    .from(serviceResourceBookings)
    .where(
      and(
        eq(serviceResourceBookings.staffUserId, staffUserId),
        lt(serviceResourceBookings.startsAt, end),
        gt(serviceResourceBookings.endsAt, start)
      )!
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

async function findVenueConflict(db: ReturnType<typeof getDb>, venueId: string, start: Date, end: Date) {
  const rows = await db
    .select({ id: serviceResourceBookings.id })
    .from(serviceResourceBookings)
    .where(
      and(
        eq(serviceResourceBookings.venueId, venueId),
        lt(serviceResourceBookings.startsAt, end),
        gt(serviceResourceBookings.endsAt, start)
      )!
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const after = req.nextUrl.searchParams.get("after"); // ISO
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "80");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 80;

  try {
    const db = getDb();
    const conditions = [];
    if (after?.trim()) {
      const d = new Date(after);
      if (!Number.isNaN(d.getTime())) {
        conditions.push(gte(serviceResourceBookings.endsAt, d));
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: serviceResourceBookings.id,
        title: serviceResourceBookings.title,
        customerServiceCaseId: serviceResourceBookings.customerServiceCaseId,
        staffUserId: serviceResourceBookings.staffUserId,
        venueId: serviceResourceBookings.venueId,
        startsAt: serviceResourceBookings.startsAt,
        endsAt: serviceResourceBookings.endsAt,
        purchaseNote: serviceResourceBookings.purchaseNote,
        estimatedCostMinor: serviceResourceBookings.estimatedCostMinor,
        notes: serviceResourceBookings.notes,
        createdAt: serviceResourceBookings.createdAt,
        staffName: users.name,
        staffEmail: users.email,
        venueName: serviceResourceVenues.name,
        caseNo: customerServiceCases.caseNo,
      })
      .from(serviceResourceBookings)
      .leftJoin(users, eq(serviceResourceBookings.staffUserId, users.id))
      .leftJoin(serviceResourceVenues, eq(serviceResourceBookings.venueId, serviceResourceVenues.id))
      .leftJoin(customerServiceCases, eq(serviceResourceBookings.customerServiceCaseId, customerServiceCases.id))
      .where(whereClause)
      .orderBy(desc(serviceResourceBookings.startsAt))
      .limit(limit);

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingTableHint(msg);
    console.error("[GET /api/service-management/bookings]", msg);
    return NextResponse.json(
      {
        error: hint ?? "讀取預約失敗",
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

  const parsed = serviceResourceBookingCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "驗證失敗", issues: parsed.error.flatten() }, { status: 400 });
  }

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return NextResponse.json({ error: "開始或結束時間格式不正確" }, { status: 400 });
  }
  if (!(endsAt > startsAt)) {
    return NextResponse.json({ error: "結束時間必須晚於開始時間" }, { status: 400 });
  }

  try {
    const db = getDb();

    if (parsed.data.staffUserId) {
      const sid = await findStaffConflict(db, parsed.data.staffUserId, startsAt, endsAt);
      if (sid) {
        return NextResponse.json(
          {
            error: "該員工在此時段已有其他預約，請調整時間或改派其他人員。",
            code: "STAFF_OVERLAP",
            conflictBookingId: sid,
          },
          { status: 409 }
        );
      }
    }

    if (parsed.data.venueId) {
      const vid = await findVenueConflict(db, parsed.data.venueId, startsAt, endsAt);
      if (vid) {
        return NextResponse.json(
          {
            error: "該場地在此時段已被預約，請另選時間或場地。",
            code: "VENUE_OVERLAP",
            conflictBookingId: vid,
          },
          { status: 409 }
        );
      }
    }

    if (parsed.data.customerServiceCaseId) {
      const exists = await db
        .select({ id: customerServiceCases.id })
        .from(customerServiceCases)
        .where(eq(customerServiceCases.id, parsed.data.customerServiceCaseId))
        .limit(1);
      if (!exists[0]) {
        return NextResponse.json({ error: "連結的案件不存在" }, { status: 400 });
      }
    }

    if (parsed.data.venueId) {
      const v = await db
        .select({ id: serviceResourceVenues.id, isActive: serviceResourceVenues.isActive })
        .from(serviceResourceVenues)
        .where(eq(serviceResourceVenues.id, parsed.data.venueId))
        .limit(1);
      if (!v[0]) {
        return NextResponse.json({ error: "場地不存在" }, { status: 400 });
      }
      if (!v[0].isActive) {
        return NextResponse.json({ error: "該場地已停用，無法預約" }, { status: 400 });
      }
    }

    const [row] = await db
      .insert(serviceResourceBookings)
      .values({
        title: parsed.data.title,
        customerServiceCaseId: parsed.data.customerServiceCaseId ?? null,
        staffUserId: parsed.data.staffUserId ?? null,
        venueId: parsed.data.venueId ?? null,
        startsAt,
        endsAt,
        purchaseNote: parsed.data.purchaseNote?.trim() || null,
        estimatedCostMinor: parsed.data.estimatedCostMinor ?? null,
        notes: parsed.data.notes?.trim() || null,
        createdByUserId: session.user.id,
      })
      .returning({
        id: serviceResourceBookings.id,
        title: serviceResourceBookings.title,
        startsAt: serviceResourceBookings.startsAt,
        endsAt: serviceResourceBookings.endsAt,
      });

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingTableHint(msg);
    console.error("[POST /api/service-management/bookings]", msg);
    return NextResponse.json(
      {
        error: hint ?? "建立預約失敗",
        hint,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
