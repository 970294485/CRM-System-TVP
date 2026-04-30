import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeArAdvanceReceipts, proformaInvoices, salesContracts } from "@/db/schema";

export const runtime = "nodejs";

function num(s: string | null | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** 匹配目標：有設定預收款目標則用預收；否則用合同含稅總額 */
function matchTargetAmount(totalRaw: string, prepayRaw: string | null): number {
  const prep = num(prepayRaw);
  if (prep > 0) return prep;
  return num(totalRaw);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();

    const contractRows = await db
      .select({
        id: salesContracts.id,
        contractNo: salesContracts.contractNo,
        customerId: salesContracts.customerId,
        customerName: salesContracts.customerName,
        totalAmount: salesContracts.totalAmount,
        prepaymentAmount: salesContracts.prepaymentAmount,
        status: salesContracts.status,
        contractDate: salesContracts.contractDate,
        proformaInvoiceNo: proformaInvoices.invoiceNo,
      })
      .from(salesContracts)
      .leftJoin(proformaInvoices, eq(proformaInvoices.contractId, salesContracts.id))
      .orderBy(desc(salesContracts.contractDate));

    const arRows = await db
      .select({
        salesContractId: financeArAdvanceReceipts.salesContractId,
        amount: financeArAdvanceReceipts.amount,
        status: financeArAdvanceReceipts.status,
      })
      .from(financeArAdvanceReceipts);

    const sums = new Map<string, { confirmed: number; draft: number }>();
    for (const r of arRows) {
      const amt = num(String(r.amount));
      if (!sums.has(r.salesContractId)) {
        sums.set(r.salesContractId, { confirmed: 0, draft: 0 });
      }
      const b = sums.get(r.salesContractId)!;
      if (r.status === "Received") b.confirmed += amt;
      else if (r.status === "Draft") b.draft += amt;
    }

    const EPS = 1e-6;
    const items = contractRows.map((c) => {
      const { confirmed, draft } = sums.get(c.id) ?? { confirmed: 0, draft: 0 };
      const total = num(String(c.totalAmount));
      const target = matchTargetAmount(String(c.totalAmount), c.prepaymentAmount);
      const remainingTarget = Math.max(0, target - confirmed);
      const remainingTotal = Math.max(0, total - confirmed);
      const prepayNum = num(c.prepaymentAmount);
      const hasPrepayTarget = prepayNum > 0;

      let matchLabel: "none" | "partial" | "target_met" | "contract_paid";
      if (confirmed <= EPS) {
        matchLabel = "none";
      } else if (remainingTotal <= EPS) {
        matchLabel = "contract_paid";
      } else if (hasPrepayTarget && remainingTarget <= EPS) {
        matchLabel = "target_met";
      } else {
        matchLabel = "partial";
      }

      return {
        salesContractId: c.id,
        contractNo: c.contractNo,
        customerId: c.customerId,
        customerName: c.customerName,
        contractTotal: c.totalAmount,
        prepaymentAmount: c.prepaymentAmount,
        hasPrepayTarget,
        matchTargetAmount: String(target),
        proformaInvoiceNo: c.proformaInvoiceNo ?? null,
        contractStatus: c.status,
        contractDate: c.contractDate,
        advanceReceivedConfirmed: String(confirmed),
        advanceReceivedDraft: String(draft),
        remainingForPrepayTarget: hasPrepayTarget ? String(remainingTarget) : null,
        remainingForContractTotal: String(remainingTotal),
        matchLabel,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/finance/ar-matching/summary]", msg);
    return NextResponse.json(
      {
        error: "無法讀取匹配總覽",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /finance_ar_advance_receipts|sales_contracts|does not exist/i.test(msg)
          ? "請確認已執行 db:apply:sales-contracts、db:apply:contracts-prepayment、db:apply:finance-payment-advance"
          : undefined,
      },
      { status: 500 }
    );
  }
}
