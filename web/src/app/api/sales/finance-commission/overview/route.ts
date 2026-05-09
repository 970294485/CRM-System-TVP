import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import {
  financeArAdvanceReceipts,
  proformaInvoices,
  salesCommissionAccruals,
  salesContracts,
  users,
} from "@/db/schema";

export const runtime = "nodejs";

function num(s: string | null | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

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
    const owner = alias(users, "sales_contract_owner");
    const beneficiary = alias(users, "commission_beneficiary");

    const commissionTotals = await db
      .select({
        contractId: salesCommissionAccruals.contractId,
        total: sql<string>`coalesce(sum(${salesCommissionAccruals.commissionAmount}), 0)::text`.as("total"),
      })
      .from(salesCommissionAccruals)
      .groupBy(salesCommissionAccruals.contractId);

    const commissionByContract = new Map<string, string>();
    for (const row of commissionTotals) {
      commissionByContract.set(row.contractId, row.total);
    }

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
        ownerUserId: salesContracts.ownerUserId,
        ownerName: owner.name,
        commissionRatePercent: salesContracts.commissionRatePercent,
      })
      .from(salesContracts)
      .leftJoin(proformaInvoices, eq(proformaInvoices.contractId, salesContracts.id))
      .leftJoin(owner, eq(salesContracts.ownerUserId, owner.id))
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
    const contracts = contractRows.map((c) => {
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
        ownerUserId: c.ownerUserId,
        ownerName: c.ownerName,
        commissionRatePercent: c.commissionRatePercent,
        commissionAccruedTotal: commissionByContract.get(c.id) ?? "0",
      };
    });

    const recentAccruals = await db
      .select({
        id: salesCommissionAccruals.id,
        contractNo: salesContracts.contractNo,
        beneficiaryName: beneficiary.name,
        ratePercent: salesCommissionAccruals.ratePercent,
        baseAmount: salesCommissionAccruals.baseAmount,
        commissionAmount: salesCommissionAccruals.commissionAmount,
        createdAt: salesCommissionAccruals.createdAt,
      })
      .from(salesCommissionAccruals)
      .innerJoin(salesContracts, eq(salesCommissionAccruals.contractId, salesContracts.id))
      .innerJoin(beneficiary, eq(salesCommissionAccruals.beneficiaryUserId, beneficiary.id))
      .orderBy(desc(salesCommissionAccruals.createdAt))
      .limit(40);

    const accrualItems = recentAccruals.map((a) => ({
      id: a.id,
      contractNo: a.contractNo,
      beneficiaryName: a.beneficiaryName,
      ratePercent: a.ratePercent,
      baseAmount: a.baseAmount,
      commissionAmount: a.commissionAmount,
      createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
    }));

    return NextResponse.json({ contracts, recentAccruals: accrualItems });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sales/finance-commission/overview]", msg);
    return NextResponse.json(
      {
        error: "無法讀取對應財務和佣金功能總覽",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /sales_commission_accruals|owner_user_id|does not exist/i.test(msg)
          ? "請執行 npm run db:apply:sales-finance-commission"
          : undefined,
      },
      { status: 500 }
    );
  }
}
