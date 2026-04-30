import { NextRequest, NextResponse } from "next/server";

import { ensureAccountingCompanySettingsRow } from "@/actions/accounting-basics";
import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  errorChainText,
  fetchGeneralLedgerOverview,
  looksLikeGeneralLedgerUnavailable,
} from "@/lib/finance/general-ledger-overview";

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
    const y = Number.isFinite(rawY) && rawY >= 2000 && rawY <= 2100 ? rawY : settingsRow.currentFiscalYear;
    const db = getDb();
    const payload = await fetchGeneralLedgerOverview(db, y, settingsRow.baseCurrencyIso);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = errorChainText(e);
    if (looksLikeGeneralLedgerUnavailable(msg)) {
      const settingsRow = await ensureAccountingCompanySettingsRow().catch(() => null);
      const y =
        Number.isFinite(rawY) && rawY >= 2000 && rawY <= 2100
          ? rawY
          : settingsRow?.currentFiscalYear ?? new Date().getFullYear();
      const iso = settingsRow?.baseCurrencyIso ?? "TWD";
      return NextResponse.json({
        year: y,
        dateFrom: `${y}-01-01`,
        dateTo: `${y}-12-31`,
        baseCurrencyIso: iso,
        chart: [],
        trialBalance: [],
        trialTotals: { debit: 0, credit: 0, balanced: true },
        journalEntries: [],
        notes: null,
        warning:
          "總賬資料表尚未建立。請在 web 目錄執行 npm run db:apply:general-ledger-init 或套用 drizzle 0017_general_ledger.sql。",
      });
    }
    console.error("[GET /api/account/general-ledger/overview]", msg);
    return NextResponse.json(
      {
        error: "無法讀取總賬數據",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
