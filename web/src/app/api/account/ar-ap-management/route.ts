import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  fetchArApManagementPayload,
  isMissingFinanceSchemaError,
} from "@/lib/finance/ar-ap-snapshot";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const payload = await fetchArApManagementPayload(db);
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isMissingFinanceSchemaError(msg)) {
      return NextResponse.json({
        receivables: {
          outstandingContractTotalSum: 0,
          contractsWithReceivableBalance: 0,
          prepaymentTargetRemainingSum: 0,
          confirmedAdvanceReceiptsTotal: 0,
          draftAdvanceReceiptsTotal: 0,
        },
        payables: {
          outstandingPurchaseOrderBalanceSum: 0,
          purchaseOrdersWithBalanceCount: 0,
          draftApPaymentRequestsSum: 0,
        },
        cashFlowLens: {
          projectedReceivableFromContracts: 0,
          projectedOutflowFromPurchaseOrders: 0,
          netPositionHint: 0,
        },
        arLines: [],
        apLines: [],
        agingArDistribution: {
          "0-30": { lineCount: 0, amountSum: 0 },
          "31-60": { lineCount: 0, amountSum: 0 },
          "61-90": { lineCount: 0, amountSum: 0 },
          "90+": { lineCount: 0, amountSum: 0 },
        },
        agingApDistribution: {
          "0-30": { lineCount: 0, amountSum: 0 },
          "31-60": { lineCount: 0, amountSum: 0 },
          "61-90": { lineCount: 0, amountSum: 0 },
          "90+": { lineCount: 0, amountSum: 0 },
        },
        notes: null,
        warning:
          "關聯資料表尚未建立或無法讀取，統計為空。請確認已執行銷售／採購／財務相關 db:apply 遷移。",
      });
    }
    console.error("[GET /api/account/ar-ap-management]", msg);
    return NextResponse.json(
      {
        error: "無法讀取應收應付數據",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
