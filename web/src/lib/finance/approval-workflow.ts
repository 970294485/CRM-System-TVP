import type { Session } from "next-auth";

import type { FinanceApprovalPolicyStep } from "@/db/schema";
import { canBypassExpenditureBudget } from "@/lib/authz";

/** 應付請款單確認付款 */
export const DOCUMENT_TYPE_AP_PAYMENT = "AP_PAYMENT";

const EPS = 1e-9;

export function num(v: string | number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function normalizePolicySteps(raw: unknown): FinanceApprovalPolicyStep[] | null {
  if (!Array.isArray(raw)) return null;
  const out: FinanceApprovalPolicyStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const label = "label" in item && typeof item.label === "string" ? item.label.trim() : "";
    const roleSlugsRaw = "roleSlugs" in item ? item.roleSlugs : "role_slugs" in item ? item.role_slugs : [];
    if (!label) return null;
    if (!Array.isArray(roleSlugsRaw) || roleSlugsRaw.length === 0) return null;
    const roleSlugs = roleSlugsRaw
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!roleSlugs.length) return null;
    out.push({ label, roleSlugs });
  }
  return out;
}

function policyAmountMin(p: { amountMin: string }): number {
  return num(p.amountMin);
}

/** 在金額之下選擇 amount_min 最大且 ≤ amount 之一筆有效策略（同 docType、啟用中） */
export function pickFinanceApprovalPolicy<
  T extends { documentType: string; amountMin: string; isActive: boolean; steps: FinanceApprovalPolicyStep[] },
>(rows: T[], documentType: string, amount: number): T | null {
  const candidates = rows
    .filter(
      (r) =>
        r.documentType === documentType &&
        r.isActive &&
        policyAmountMin(r) <= amount + EPS &&
        Array.isArray(r.steps) &&
        r.steps.length > 0
    )
    .sort((a, b) => policyAmountMin(b) - policyAmountMin(a));
  return candidates[0] ?? null;
}

export function userHasAnyRoleSlug(session: Session | null, slugs: string[]): boolean {
  const userSlugs = session?.user?.roleSlugs ?? [];
  return slugs.some((s) => userSlugs.includes(s));
}

/** super_admin：與預算繞過一致，可作審批與確認付款全流程繞過 */
export function canBypassFinanceApproval(session: Session | null): boolean {
  return canBypassExpenditureBudget(session);
}

export function canUserSignStep(
  session: Session | null,
  step: FinanceApprovalPolicyStep | undefined
): boolean {
  if (!step) return false;
  if (canBypassFinanceApproval(session)) return true;
  return userHasAnyRoleSlug(session, step.roleSlugs);
}

/** 已取得核准的 step 索引集合 */
export function completedStepIndexes(indexes: number[]): Set<number> {
  return new Set(indexes.filter((n) => Number.isInteger(n) && n >= 0));
}

export function nextMissingStepIndex(totalSteps: number, completed: Set<number>): number | null {
  for (let i = 0; i < totalSteps; i++) {
    if (!completed.has(i)) return i;
  }
  return null;
}

export function isApprovalFullyDone(totalSteps: number, completed: Set<number>): boolean {
  return totalSteps > 0 && completed.size >= totalSteps;
}
