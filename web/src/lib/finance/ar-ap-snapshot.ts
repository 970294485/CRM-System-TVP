import { desc, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import {
  financeApPaymentRequests,
  financeArAdvanceReceipts,
  proformaInvoices,
  purchaseOrders,
  salesContracts,
} from "@/db/schema";

import { isMissingFinanceApTableError } from "./is-missing-finance-ap-table";

export const EPS = 1e-6;

export function num(s: string | null | undefined): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function matchTargetAmount(totalRaw: string, prepayRaw: string | null): number {
  const prep = num(prepayRaw);
  if (prep > 0) return prep;
  return num(totalRaw);
}

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export function bucketForDays(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

/** 以文件日（合同日／採購日）距今日之日數；UTC 正午對齊避免 DST 邊界。 */
export function daysSinceDocDate(isoDateStr: string): number {
  const doc = new Date(`${isoDateStr}T12:00:00.000Z`);
  const now = new Date();
  const ms = now.getTime() - doc.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export type ArLine = {
  contractId: string;
  contractNo: string;
  customerName: string;
  contractDate: string;
  proformaInvoiceNo: string | null;
  totalAmount: number;
  confirmedReceipts: number;
  remainingTotal: number;
  prepayRemaining: number | null;
  daysSinceContract: number;
  agingBucket: AgingBucket;
};

export type ApLine = {
  purchaseOrderId: string;
  poNo: string;
  supplierName: string | null;
  poDate: string;
  totalAmount: number;
  paidAmount: number;
  unpaidBalance: number;
  paymentStatus: string;
  daysSincePo: number;
  agingBucket: AgingBucket;
};

export type ArApManagementPayload = {
  receivables: {
    outstandingContractTotalSum: number;
    contractsWithReceivableBalance: number;
    prepaymentTargetRemainingSum: number;
    confirmedAdvanceReceiptsTotal: number;
    draftAdvanceReceiptsTotal: number;
  };
  payables: {
    outstandingPurchaseOrderBalanceSum: number;
    purchaseOrdersWithBalanceCount: number;
    draftApPaymentRequestsSum: number;
  };
  cashFlowLens: {
    projectedReceivableFromContracts: number;
    projectedOutflowFromPurchaseOrders: number;
    netPositionHint: number;
  };
  arLines: ArLine[];
  apLines: ApLine[];
  /** 仍有待收餘額之合同，按帳齡桶加總剩餘本金 */
  agingArDistribution: Record<AgingBucket, { lineCount: number; amountSum: number }>;
  /** 仍有未付餘額之採購單 */
  agingApDistribution: Record<AgingBucket, { lineCount: number; amountSum: number }>;
  notes: {
    receivable: string;
    payable: string;
    cashFlow: string;
    aging: string;
  };
};

const EMPTY_BUCKETS = (): Record<AgingBucket, { lineCount: number; amountSum: number }> => ({
  "0-30": { lineCount: 0, amountSum: 0 },
  "31-60": { lineCount: 0, amountSum: 0 },
  "61-90": { lineCount: 0, amountSum: 0 },
  "90+": { lineCount: 0, amountSum: 0 },
});

export function isMissingFinanceSchemaError(message: string): boolean {
  const msg = message;
  const missingFinanceRelation =
    /does\s+not\s+exist/i.test(msg) && /finance_|sales_contracts|purchase_orders/i.test(msg);
  return isMissingFinanceApTableError(msg) || missingFinanceRelation;
}

export async function fetchArApManagementPayload(db: NeonHttpDatabase<typeof schema>): Promise<ArApManagementPayload> {
  const contractRows = await db
    .select({
      id: salesContracts.id,
      contractNo: salesContracts.contractNo,
      customerName: salesContracts.customerName,
      totalAmount: salesContracts.totalAmount,
      prepaymentAmount: salesContracts.prepaymentAmount,
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

  const arSums = new Map<string, { confirmed: number; draft: number }>();
  for (const r of arRows) {
    const amt = num(String(r.amount));
    if (!arSums.has(r.salesContractId)) {
      arSums.set(r.salesContractId, { confirmed: 0, draft: 0 });
    }
    const b = arSums.get(r.salesContractId)!;
    if (r.status === "Received") b.confirmed += amt;
    else if (r.status === "Draft") b.draft += amt;
  }

  let outstandingContractSum = 0;
  let prepayTargetRemainingSum = 0;
  let contractsWithReceivableBalance = 0;
  let confirmedReceiptsTotal = 0;
  let draftReceiptsTotal = 0;

  const arLines: ArLine[] = [];
  const agingArDistribution = EMPTY_BUCKETS();

  for (const c of contractRows) {
    const { confirmed, draft } = arSums.get(c.id) ?? { confirmed: 0, draft: 0 };
    confirmedReceiptsTotal += confirmed;
    draftReceiptsTotal += draft;
    const total = num(String(c.totalAmount));
    const target = matchTargetAmount(String(c.totalAmount), c.prepaymentAmount);
    const remainingTotal = Math.max(0, total - confirmed);
    const prepayNum = num(c.prepaymentAmount);
    const hasPrepayTarget = prepayNum > 0;
    const remainingTarget = Math.max(0, target - confirmed);

    if (remainingTotal > EPS) {
      outstandingContractSum += remainingTotal;
      contractsWithReceivableBalance += 1;
    }
    if (hasPrepayTarget && remainingTarget > EPS) {
      prepayTargetRemainingSum += remainingTarget;
    }

    const contractDateStr = typeof c.contractDate === "string" ? c.contractDate : String(c.contractDate);
    const daysSinceContract = daysSinceDocDate(contractDateStr);
    const agingBucket = bucketForDays(daysSinceContract);

    if (remainingTotal > EPS || (hasPrepayTarget && remainingTarget > EPS)) {
      arLines.push({
        contractId: c.id,
        contractNo: c.contractNo,
        customerName: c.customerName,
        contractDate: contractDateStr,
        proformaInvoiceNo: c.proformaInvoiceNo ?? null,
        totalAmount: total,
        confirmedReceipts: confirmed,
        remainingTotal,
        prepayRemaining: hasPrepayTarget ? remainingTarget : null,
        daysSinceContract,
        agingBucket,
      });
    }

    if (remainingTotal > EPS) {
      const cell = agingArDistribution[agingBucket];
      cell.lineCount += 1;
      cell.amountSum += remainingTotal;
    }
  }

  arLines.sort((a, b) => b.remainingTotal - a.remainingTotal);

  const poRows = await db
    .select({
      id: purchaseOrders.id,
      poNo: purchaseOrders.poNo,
      supplierName: purchaseOrders.customerName,
      totalAmount: purchaseOrders.totalAmount,
      paidAmount: purchaseOrders.paidAmount,
      paymentStatus: purchaseOrders.paymentStatus,
      poDate: purchaseOrders.poDate,
    })
    .from(purchaseOrders)
    .orderBy(desc(purchaseOrders.poDate));

  let outstandingPoSum = 0;
  let posWithPayableBalance = 0;
  const apLines: ApLine[] = [];
  const agingApDistribution = EMPTY_BUCKETS();

  for (const p of poRows) {
    const total = num(String(p.totalAmount));
    const paid = num(String(p.paidAmount));
    const unpaid = Math.max(0, total - paid);
    const poDateStr = typeof p.poDate === "string" ? p.poDate : String(p.poDate);
    const daysSincePo = daysSinceDocDate(poDateStr);
    const agingBucket = bucketForDays(daysSincePo);

    if (unpaid > EPS) {
      outstandingPoSum += unpaid;
      posWithPayableBalance += 1;
      apLines.push({
        purchaseOrderId: p.id,
        poNo: p.poNo,
        supplierName: p.supplierName,
        poDate: poDateStr,
        totalAmount: total,
        paidAmount: paid,
        unpaidBalance: unpaid,
        paymentStatus: p.paymentStatus,
        daysSincePo,
        agingBucket,
      });
      const cell = agingApDistribution[agingBucket];
      cell.lineCount += 1;
      cell.amountSum += unpaid;
    }
  }

  apLines.sort((a, b) => b.unpaidBalance - a.unpaidBalance);

  const apDraftRows = await db
    .select({ amount: financeApPaymentRequests.amount, status: financeApPaymentRequests.status })
    .from(financeApPaymentRequests);
  let draftApRequestsSum = 0;
  for (const r of apDraftRows) {
    if (r.status === "Draft") draftApRequestsSum += num(String(r.amount));
  }

  return {
    receivables: {
      outstandingContractTotalSum: outstandingContractSum,
      contractsWithReceivableBalance,
      prepaymentTargetRemainingSum: prepayTargetRemainingSum,
      confirmedAdvanceReceiptsTotal: confirmedReceiptsTotal,
      draftAdvanceReceiptsTotal: draftReceiptsTotal,
    },
    payables: {
      outstandingPurchaseOrderBalanceSum: outstandingPoSum,
      purchaseOrdersWithBalanceCount: posWithPayableBalance,
      draftApPaymentRequestsSum: draftApRequestsSum,
    },
    cashFlowLens: {
      projectedReceivableFromContracts: outstandingContractSum,
      projectedOutflowFromPurchaseOrders: outstandingPoSum,
      netPositionHint: outstandingContractSum - outstandingPoSum,
    },
    arLines,
    apLines,
    agingArDistribution,
    agingApDistribution,
    notes: {
      receivable:
        "應收以銷售合同為準：已確認預收款單（Received）自合同總額扣減；不含僅存在於銀行未登帳之款項。",
      payable: "應付以採購單已付金額與總額差額為準；已開立但未確認之應付請款單另見財務「請款與預收款」草稿統計。",
      cashFlow:
        "淨頭寸 = 合同端待收 − 採購端待付，為營運資金壓力之粗估示意，不作會計準則意義上的現金流量表。",
      aging:
        "帳齡以合同日／採購日起算之日數分桶（0–30、31–60、61–90、90+ 天）；未設定約定付款日時供催收與資金排程參考。",
    },
  };
}
