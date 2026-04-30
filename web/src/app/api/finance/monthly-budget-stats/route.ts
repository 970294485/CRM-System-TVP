import { and, eq, isNotNull, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  employeeSettings,
  financeApPaymentRequests,
  financeArAdvanceReceipts,
} from "@/db/schema";
import { isMissingFinanceApTableError } from "@/lib/finance/is-missing-finance-ap-table";

export const runtime = "nodejs";

function monthFromTs(value: Date | string | null | undefined): number | null {
  if (value == null) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCMonth() + 1;
}

function addToBucket(buckets: number[], month: number, amountStr: string) {
  if (month < 1 || month > 12) return;
  const n = Number(amountStr);
  if (!Number.isFinite(n)) return;
  buckets[month - 1] += n;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const yearParam = req.nextUrl.searchParams.get("year");
  const y = yearParam ? Number.parseInt(yearParam, 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    return NextResponse.json({ error: "year 參數無效" }, { status: 400 });
  }

  const apTotals = Array.from({ length: 12 }, () => 0);
  const arTotals = Array.from({ length: 12 }, () => 0);

  try {
    const db = getDb();

    const [payrollRow] = await db
      .select({
        total: sql<string>`COALESCE(SUM(${employeeSettings.baseSalary}), 0)`,
      })
      .from(employeeSettings)
      .where(eq(employeeSettings.isActive, true));

    const payrollBaseline = Number(payrollRow?.total ?? 0);
    const payrollBaselineFinite = Number.isFinite(payrollBaseline) ? payrollBaseline : 0;

    const apRows = await db
      .select({
        amount: financeApPaymentRequests.amount,
        confirmedAt: financeApPaymentRequests.confirmedAt,
      })
      .from(financeApPaymentRequests)
      .where(
        and(
          eq(financeApPaymentRequests.status, "Confirmed"),
          isNotNull(financeApPaymentRequests.confirmedAt)
        )
      );

    for (const row of apRows) {
      const m = monthFromTs(row.confirmedAt);
      if (m == null) continue;
      if (new Date(row.confirmedAt as Date).getUTCFullYear() !== y) continue;
      addToBucket(apTotals, m, String(row.amount));
    }

    const arRows = await db
      .select({
        amount: financeArAdvanceReceipts.amount,
        receivedAt: financeArAdvanceReceipts.receivedAt,
      })
      .from(financeArAdvanceReceipts)
      .where(
        and(
          eq(financeArAdvanceReceipts.status, "Received"),
          isNotNull(financeArAdvanceReceipts.receivedAt)
        )
      );

    for (const row of arRows) {
      const m = monthFromTs(row.receivedAt);
      if (m == null) continue;
      if (new Date(row.receivedAt as Date).getUTCFullYear() !== y) continue;
      addToBucket(arTotals, m, String(row.amount));
    }

    const months = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const ap = apTotals[i];
      const ar = arTotals[i];
      return {
        month,
        label: `${y}年${month}月`,
        confirmedApOutflow: ap,
        confirmedArInflow: ar,
        netConfirmedCash: ar - ap,
      };
    });

    return NextResponse.json({
      year: y,
      months,
      payrollBaselineMonthly: payrollBaselineFinite,
      notes: {
        inflow:
          "收入欄為「已確認收款」的預收款單金額（按 received_at 所屬月份）；完整「合同核銷」維度請搭配合同匹配功能使用。",
        outflow:
          "支出欄為「已確認付款」的應付請款單金額（按 confirmed_at 所屬月份）。",
        payroll:
          "人事底薪合計為當前在職員工 base_salary 加總，作為月度固定成本參考；實際發薪入帳待模組 8 發薪流水對接後可再細分。",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingFinanceApTableError(msg)) {
      return NextResponse.json({
        year: y,
        months: Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          label: `${y}年${i + 1}月`,
          confirmedApOutflow: 0,
          confirmedArInflow: 0,
          netConfirmedCash: 0,
        })),
        payrollBaselineMonthly: 0,
        warning:
          "財務請款／預收表尚未建立，統計為空。請執行 npm run db:apply:finance-payment-advance。",
        notes: null,
      });
    }
    console.error("[GET /api/finance/monthly-budget-stats]", msg);
    return NextResponse.json(
      {
        error: "無法讀取月度統計",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
