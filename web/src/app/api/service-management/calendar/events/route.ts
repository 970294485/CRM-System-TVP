import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  type CalendarGatherParams,
  gatherAssignedCaseMarkers,
  gatherCalendarBookingEvents,
  missingCalendarHint,
} from "@/lib/service-management/calendar-events";

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
    return NextResponse.json({ error: "查詢區間最長 120 天" }, { status: 400 });
  }

  try {
    const db = getDb();
    const params = { from, to, scope, userId: session.user.id, q: q || undefined };
    const [bookings, assignedCaseMarkers] = await Promise.all([
      gatherCalendarBookingEvents(db, params),
      gatherAssignedCaseMarkers(db, params),
    ]);

    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      scope,
      bookings,
      assignedCaseMarkers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const hint = missingCalendarHint(msg);
    console.error("[GET /api/service-management/calendar/events]", msg);
    return NextResponse.json(
      {
        error: hint ?? "讀取行事曆資料失敗",
        hint,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
