import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { fetchArApManagementPayload, isMissingFinanceSchemaError } from "@/lib/finance/ar-ap-snapshot";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const payload = await fetchArApManagementPayload(db);

    const topContracts = payload.arLines.slice(0, 10).map((r) => ({
      contractNo: r.contractNo,
      customerName: r.customerName,
      remainingTotal: r.remainingTotal,
      prepayRemaining: r.prepayRemaining,
      contractDate: r.contractDate,
    }));

    const topPos = payload.apLines.slice(0, 10).map((r) => ({
      poNo: r.poNo,
      supplierName: r.supplierName,
      unpaidBalance: r.unpaidBalance,
      paymentStatus: r.paymentStatus,
      poDate: r.poDate,
    }));

    return NextResponse.json({
      receivables: payload.receivables,
      payables: payload.payables,
      cashFlowLens: payload.cashFlowLens,
      topContractsByRemaining: topContracts,
      topPurchaseOrdersByUnpaid: topPos,
      notes: {
        receivable: payload.notes.receivable,
        payable: payload.notes.payable,
        cashFlow: payload.notes.cashFlow,
      },
    });
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
        topContractsByRemaining: [] as Record<string, unknown>[],
        topPurchaseOrdersByUnpaid: [] as Record<string, unknown>[],
        warning:
          "關聯資料表尚未建立或無法讀取，統計為空。請確認已執行 sales／採購／財務相關 db:apply 遷移。",
        notes: null,
      });
    }
    console.error("[GET /api/finance/analytics-overview]", msg);
    return NextResponse.json(
      {
        error: "無法讀取財務分析數據",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
      },
      { status: 500 }
    );
  }
}
