import { eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import { employeeSettings, purchaseOrders, salesContracts } from "@/db/schema";

import { num } from "@/lib/finance/ar-ap-snapshot";

export type MonthlyPlRow = {
  month: number;
  label: string;
  revenue: number;
  procurementCost: number;
  payrollExpense: number;
  grossProfit: number;
  operatingProfit: number;
  contractCount: number;
  purchaseOrderCount: number;
};

export type QuarterPlAgg = {
  quarter: 1 | 2 | 3 | 4;
  label: string;
  revenue: number;
  procurementCost: number;
  payrollExpense: number;
  grossProfit: number;
  operatingProfit: number;
};

export type IncomeStatementPayload = {
  year: number;
  baseCurrencyIso: string;
  payrollMonthlyEstimate: number;
  months: MonthlyPlRow[];
  quarters: QuarterPlAgg[];
  annual: {
    revenue: number;
    procurementCost: number;
    payrollExpense: number;
    grossProfit: number;
    operatingProfit: number;
    contractCount: number;
    purchaseOrderCount: number;
  };
  notes: {
    revenue: string;
    procurement: string;
    payroll: string;
    interpretation: string;
  };
};

function ymdParts(value: string | Date): { year: number; month: number } | null {
  const s = typeof value === "string" ? value.trim().slice(0, 10) : value.toISOString().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(s);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function isMissingIncomeStatementSchemaError(message: string): boolean {
  const msg = message;
  return (
    /does\s+not\s+exist/i.test(msg) &&
    /sales_contracts|purchase_orders|employee_settings/i.test(msg)
  );
}

export async function fetchIncomeStatementPayload(
  db: NeonHttpDatabase<typeof schema>,
  year: number,
  baseCurrencyIso: string
): Promise<IncomeStatementPayload> {
  const revenueByMonth = Array.from({ length: 12 }, () => 0);
  const procurementByMonth = Array.from({ length: 12 }, () => 0);
  const contractCountByMonth = Array.from({ length: 12 }, () => 0);
  const poCountByMonth = Array.from({ length: 12 }, () => 0);

  const contractRows = await db
    .select({
      totalAmount: salesContracts.totalAmount,
      contractDate: salesContracts.contractDate,
    })
    .from(salesContracts);

  for (const row of contractRows) {
    const parts = ymdParts(row.contractDate as string | Date);
    if (!parts || parts.year !== year) continue;
    const idx = parts.month - 1;
    if (idx < 0 || idx > 11) continue;
    revenueByMonth[idx] += num(String(row.totalAmount));
    contractCountByMonth[idx] += 1;
  }

  const poRows = await db
    .select({
      totalAmount: purchaseOrders.totalAmount,
      poDate: purchaseOrders.poDate,
    })
    .from(purchaseOrders);

  for (const row of poRows) {
    const parts = ymdParts(row.poDate as string | Date);
    if (!parts || parts.year !== year) continue;
    const idx = parts.month - 1;
    if (idx < 0 || idx > 11) continue;
    procurementByMonth[idx] += num(String(row.totalAmount));
    poCountByMonth[idx] += 1;
  }

  const [payrollRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${employeeSettings.baseSalary}), 0)`,
    })
    .from(employeeSettings)
    .where(eq(employeeSettings.isActive, true));

  const payrollMonthly = num(String(payrollRow?.total ?? "0"));

  const months: MonthlyPlRow[] = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const revenue = revenueByMonth[i];
    const procurementCost = procurementByMonth[i];
    const payrollExpense = payrollMonthly;
    const grossProfit = revenue - procurementCost;
    const operatingProfit = grossProfit - payrollExpense;
    return {
      month,
      label: `${year}年${month}月`,
      revenue,
      procurementCost,
      payrollExpense,
      grossProfit,
      operatingProfit,
      contractCount: contractCountByMonth[i],
      purchaseOrderCount: poCountByMonth[i],
    };
  });

  const quarters: QuarterPlAgg[] = [1, 2, 3, 4].map((q) => {
    const start = (q - 1) * 3;
    const slice = months.slice(start, start + 3);
    const revenue = slice.reduce((s, r) => s + r.revenue, 0);
    const procurementCost = slice.reduce((s, r) => s + r.procurementCost, 0);
    const payrollExpense = slice.reduce((s, r) => s + r.payrollExpense, 0);
    const grossProfit = slice.reduce((s, r) => s + r.grossProfit, 0);
    const operatingProfit = slice.reduce((s, r) => s + r.operatingProfit, 0);
    return {
      quarter: q as 1 | 2 | 3 | 4,
      label: `${year}年第${q}季`,
      revenue,
      procurementCost,
      payrollExpense,
      grossProfit,
      operatingProfit,
    };
  });

  const annual = {
    revenue: months.reduce((s, r) => s + r.revenue, 0),
    procurementCost: months.reduce((s, r) => s + r.procurementCost, 0),
    payrollExpense: months.reduce((s, r) => s + r.payrollExpense, 0),
    grossProfit: months.reduce((s, r) => s + r.grossProfit, 0),
    operatingProfit: months.reduce((s, r) => s + r.operatingProfit, 0),
    contractCount: months.reduce((s, r) => s + r.contractCount, 0),
    purchaseOrderCount: months.reduce((s, r) => s + r.purchaseOrderCount, 0),
  };

  return {
    year,
    baseCurrencyIso,
    payrollMonthlyEstimate: payrollMonthly,
    months,
    quarters,
    annual,
    notes: {
      revenue:
        "營業收入按銷售合同「合同日」所屬月份彙總含稅總額；與現金收款時點不同，亦未區分履約進度或 IFRS／CAS 收入準則。",
      procurement:
        "採購成本按採購單「採購日」所屬月份彙總含稅總額，作為進貨／營業成本之營運參考，非嚴格存貨結轉。",
      payroll:
        "人事費用為當前在職員工底薪（base_salary）加總，於各月重複列示相同估算金額；獎金、勞健保與實際發薪批次請以後續發薪流水為準。",
      interpretation:
        "毛利 = 營業收入 − 採購成本；營業利益 = 毛利 − 月度人事估算。本表為管理用簡式損益，不作對外財報或報稅依據。",
    },
  };
}
