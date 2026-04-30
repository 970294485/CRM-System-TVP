import { eq, like } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeMonthlyExpenditureBudgets } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { calendarMonthBoundsUtc, sumPurchaseCommittedForMonth } from "@/lib/finance/expenditure-budget";

export const runtime = "nodejs";

const upsertSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  capAmount: z.coerce.number().finite().min(0),
  isActive: z.boolean(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const yearRaw = req.nextUrl.searchParams.get("year");
  const year = yearRaw ? Number.parseInt(yearRaw, 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(year) || year < 1990 || year > 2120) {
    return NextResponse.json({ error: "year 參數無效" }, { status: 400 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(financeMonthlyExpenditureBudgets)
      .where(like(financeMonthlyExpenditureBudgets.yearMonth, `${year}-%`))
      .orderBy(financeMonthlyExpenditureBudgets.yearMonth);

    const capByYm = new Map(rows.map((r) => [r.yearMonth, r]));

    const months = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const m = String(i + 1).padStart(2, "0");
        const ym = `${year}-${m}`;
        const b = capByYm.get(ym);
        const committed = await sumPurchaseCommittedForMonth(ym);
        const cap = b?.isActive ? Number(String(b.capAmount)) : null;
        const capOk = cap != null && Number.isFinite(cap);
        const remaining = capOk ? cap! - committed : null;
        return {
          yearMonth: ym,
          capAmount: b ? String(b.capAmount) : null,
          isActive: b?.isActive ?? false,
          notes: b?.notes ?? null,
          updatedAt: b?.updatedAt?.toISOString() ?? null,
          committedPurchaseTotal: committed,
          remainingAgainstCap: remaining,
          enforcementOn: !!(b?.isActive && capOk),
        };
      })
    );

    return NextResponse.json({ year, months });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/finance_monthly_expenditure_budgets|does not exist/i.test(msg)) {
      return NextResponse.json({
        year,
        months: Array.from({ length: 12 }, (_, i) => ({
          yearMonth: `${year}-${String(i + 1).padStart(2, "0")}`,
          capAmount: null,
          isActive: false,
          notes: null,
          updatedAt: null,
          committedPurchaseTotal: 0,
          remainingAgainstCap: null,
          enforcementOn: false,
        })),
        warning:
          "預算表尚未建立。請於 web 目錄執行：npm run db:apply:finance-expenditure-budget",
      });
    }
    console.error("[GET /api/finance/expenditure-budget]", msg);
    return NextResponse.json(
      {
        error: "無法讀取預算設定",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數錯誤", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { yearMonth, capAmount, isActive, notes } = parsed.data;
  if (!calendarMonthBoundsUtc(yearMonth)) {
    return NextResponse.json({ error: "yearMonth 無效" }, { status: 400 });
  }

  try {
    const db = getDb();
    const noteTrim = notes?.trim() || null;

    const [existing] = await db
      .select({ id: financeMonthlyExpenditureBudgets.id })
      .from(financeMonthlyExpenditureBudgets)
      .where(eq(financeMonthlyExpenditureBudgets.yearMonth, yearMonth))
      .limit(1);

    let row;
    if (existing) {
      [row] = await db
        .update(financeMonthlyExpenditureBudgets)
        .set({
          capAmount: String(capAmount),
          isActive,
          notes: noteTrim,
          updatedAt: new Date(),
        })
        .where(eq(financeMonthlyExpenditureBudgets.yearMonth, yearMonth))
        .returning();
    } else {
      [row] = await db
        .insert(financeMonthlyExpenditureBudgets)
        .values({
          yearMonth,
          capAmount: String(capAmount),
          isActive,
          notes: noteTrim,
        })
        .returning();
    }

    return NextResponse.json({ budget: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/finance/expenditure-budget]", msg);
    return NextResponse.json(
      {
        error: "無法儲存預算",
        hint: /does not exist/i.test(msg)
          ? "請執行 npm run db:apply:finance-expenditure-budget"
          : undefined,
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
