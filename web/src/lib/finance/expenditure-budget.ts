import { and, eq, gte, lte, sql } from "drizzle-orm";
import type { Session } from "next-auth";

import { getDb } from "@/db";
import {
  financeMonthlyExpenditureBudgets,
  purchaseOrders,
} from "@/db/schema";
import { canBypassExpenditureBudget } from "@/lib/authz";

export function parseYearMonthFromPoDate(poDate: string): string | null {
  const s = typeof poDate === "string" ? poDate.trim() : "";
  const m = s.match(/^(\d{4}-\d{2})/);
  return m ? m[1]! : null;
}

/** Inclusive UTC calendar bounds for Postgres `date` comparison (YYYY-MM-DD strings). */
export function calendarMonthBoundsUtc(yearMonth: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(yearMonth.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  const start = `${m[1]}-${m[2]}-01`;
  const lastDay = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const end = `${m[1]}-${m[2]}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function numAmount(v: string | number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function sumPurchaseCommittedForMonth(yearMonth: string): Promise<number> {
  const bounds = calendarMonthBoundsUtc(yearMonth);
  if (!bounds) return 0;
  const db = getDb();
  const [row] = await db
    .select({ s: sql<string>`COALESCE(SUM(${purchaseOrders.totalAmount})::numeric, 0)` })
    .from(purchaseOrders)
    .where(
      and(gte(purchaseOrders.poDate, bounds.start), lte(purchaseOrders.poDate, bounds.end))
    );
  return numAmount(row?.s ?? 0);
}

export async function getActiveBudgetCap(yearMonth: string): Promise<number | null> {
  const db = getDb();
  const [row] = await db
    .select({
      cap: financeMonthlyExpenditureBudgets.capAmount,
      active: financeMonthlyExpenditureBudgets.isActive,
    })
    .from(financeMonthlyExpenditureBudgets)
    .where(eq(financeMonthlyExpenditureBudgets.yearMonth, yearMonth))
    .limit(1);
  if (!row?.active) return null;
  return numAmount(String(row.cap));
}

export type PoImportBudgetRow = {
  po_date: string;
  total_amount: string | number;
};

export type BudgetGateViolation = {
  yearMonth: string;
  cap: number;
  committedBefore: number;
  batchAddition: number;
  projectedTotal: number;
};

export async function evaluatePurchaseOrderImportAgainstBudget(
  parsedRows: PoImportBudgetRow[],
  session: Session | null
): Promise<
  | { ok: true; skippedBecause?: string }
  | { ok: false; violations: BudgetGateViolation[]; message: string }
> {
  if (!parsedRows.length) return { ok: true };
  if (canBypassExpenditureBudget(session)) {
    return { ok: true, skippedBecause: "super_admin_budget_bypass" };
  }

  const freshByMonth = new Map<string, number>();
  for (const p of parsedRows) {
    const ym = parseYearMonthFromPoDate(p.po_date);
    if (!ym) continue;
    freshByMonth.set(ym, (freshByMonth.get(ym) ?? 0) + numAmount(p.total_amount));
  }

  try {
    const violations: BudgetGateViolation[] = [];
    for (const [ym, batchAddition] of freshByMonth) {
      if (batchAddition <= 1e-9) continue;
      const cap = await getActiveBudgetCap(ym);
      if (cap == null) continue;
      const committedBefore = await sumPurchaseCommittedForMonth(ym);
      const projected = committedBefore + batchAddition;
      if (projected > cap + 1e-6) {
        violations.push({
          yearMonth: ym,
          cap,
          committedBefore,
          batchAddition,
          projectedTotal: projected,
        });
      }
    }

    if (violations.length) {
      const v0 = violations[0]!;
      const message = `採購月度支出預算超限：「${v0.yearMonth}」上限 ${v0.cap.toFixed(2)}，已有承諾 ${v0.committedBefore.toFixed(2)}，本批次再增 ${v0.batchAddition.toFixed(2)} 將達 ${v0.projectedTotal.toFixed(2)}。需超級管理員帳號繞過或調高該月預算。`;
      return { ok: false, violations, message };
    }

    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/finance_monthly_expenditure_budgets|does not exist/i.test(msg)) {
      return { ok: true, skippedBecause: "budget_tables_missing" };
    }
    throw e;
  }
}
