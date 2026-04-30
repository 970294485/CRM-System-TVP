import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  type CalendarGatherParams,
  gatherAssignedCaseMarkers,
  gatherCalendarBookingEvents,
  missingCalendarHint,
} from "@/lib/service-management/calendar-events";
import { buildServiceManagementIcs } from "@/lib/service-management/ics-builder";

export const runtime = "nodejs";

function parseIsoDate(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const scopeRaw = req.nextUrl.searchParams.get("scope") ?? "all";
  const scope: CalendarGatherParams["scope"] = scopeRaw === "mine" ? "mine" : "all";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  const from =
    parseIsoDate(fromParam) ??
    (() => {
      const n = new Date();
      return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0));
    })();

  const to =
    parseIsoDate(toParam) ??
    (() => {
      const t = new Date(from);
      t.setUTCDate(t.getUTCDate() + 21);
      return t;
    })();

  if (!(to > from)) {
    return NextResponse.json({ error: "時間區間無效（結束須晚於開始）" }, { status: 400 });
  }

  const maxMs = 120 * 24 * 60 * 60 * 1000;
  if (to.getTime() - from.getTime() > maxMs) {
    return NextResponse.json({ error: "匯出區間最長 120 天" }, { status: 400 });
  }

  try {
    const db = getDb();
    const params = { from, to, scope, userId: session.user.id, q: q || undefined };
    const [bookings, caseMarkers] = await Promise.all([
      gatherCalendarBookingEvents(db, params),
      gatherAssignedCaseMarkers(db, params),
    ]);

    const ics = buildServiceManagementIcs({
      bookings,
      caseMarkers,
      calendarName:
        scope === "mine"
          ? "CRM 服務／指派（我的）"
          : "CRM 服務／指派（全員預約＋區間內更新之指派案件）",
    });

    const fname = `crm-service-calendar-${scope}-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.ics`;

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingCalendarHint(msg);
    console.error("[GET /api/service-management/calendar/export-ics]", msg);
    return NextResponse.json(
      {
        error: hint ?? "匯出失敗",
        hint,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
