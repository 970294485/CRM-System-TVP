import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { ensureAccountingCompanySettingsRow } from "@/actions/accounting-basics";
import { getDb } from "@/db";
import {
  fetchIncomeStatementPayload,
  isMissingIncomeStatementSchemaError,
} from "@/lib/finance/income-statement-snapshot";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const yearParam = req.nextUrl.searchParams.get("year");
  const rawY = yearParam ? Number.parseInt(yearParam, 10) : NaN;

  try {
    const settingsRow = await ensureAccountingCompanySettingsRow();
    const fallbackYear = settingsRow.currentFiscalYear;
    const y = Number.isFinite(rawY) && rawY >= 2000 && rawY <= 2100 ? rawY : fallbackYear;

    const db = getDb();
    const payload = await fetchIncomeStatementPayload(db, y, settingsRow.baseCurrencyIso);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingIncomeStatementSchemaError(msg)) {
      const settingsRow = await ensureAccountingCompanySettingsRow().catch(() => null);
      const y =
        Number.isFinite(rawY) && rawY >= 2000 && rawY <= 2100
          ? rawY
          : settingsRow?.currentFiscalYear ?? new Date().getFullYear();
      const iso = settingsRow?.baseCurrencyIso ?? "TWD";
      const emptyMonths = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        label: `${y}年${i + 1}月`,
        revenue: 0,
        procurementCost: 0,
        payrollExpense: 0,
        grossProfit: 0,
        operatingProfit: 0,
        contractCount: 0,
        purchaseOrderCount: 0,
      }));
      const emptyQuarters = [1, 2, 3, 4].map((q) => ({
        quarter: q as 1 | 2 | 3 | 4,
        label: `${y}年第${q}季`,
        revenue: 0,
        procurementCost: 0,
        payrollExpense: 0,
        grossProfit: 0,
        operatingProfit: 0,
      }));
      return NextResponse.json({
        year: y,
        baseCurrencyIso: iso,
        payrollMonthlyEstimate: 0,
        months: emptyMonths,
        quarters: emptyQuarters,
        annual: {
          revenue: 0,
          procurementCost: 0,
          payrollExpense: 0,
          grossProfit: 0,
          operatingProfit: 0,
          contractCount: 0,
          purchaseOrderCount: 0,
        },
        notes: null,
        warning:
          "無法讀取合同／採購／人事資料表，損益為空。請確認已執行相關資料庫遷移。",
      });
    }
    console.error("[GET /api/account/income-statement]", msg);
    return NextResponse.json(
      {
        error: "無法讀取利潤表數據",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
