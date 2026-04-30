import { and, eq, inArray } from "drizzle-orm";
import type { Session } from "next-auth";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import type * as schema from "@/db/schema";
import {
  financeApprovalEvents,
  financeApprovalPolicies,
  financeApPaymentRequests,
} from "@/db/schema";
import {
  canBypassFinanceApproval,
  canUserSignStep,
  DOCUMENT_TYPE_AP_PAYMENT,
  completedStepIndexes,
  isApprovalFullyDone,
  nextMissingStepIndex,
  num,
  pickFinanceApprovalPolicy,
} from "@/lib/finance/approval-workflow";

export type ApApprovalStatusPayload = {
  id: string;
  policyId: string | null;
  policyName: string | null;
  totalSteps: number;
  completedSteps: number;
  steps: { index: number; label: string; done: boolean; roleSlugs: string[] }[];
  canSignNextStep: boolean;
  /** 「確認付款」是否允許（已滿足審批或無策略／超級管理員繞過） */
  canFinalizeConfirm: boolean;
};

export async function buildApApprovalStatusBatch(
  db: NeonHttpDatabase<typeof schema>,
  apIds: string[],
  session: Session | null
): Promise<Map<string, ApApprovalStatusPayload>> {
  const out = new Map<string, ApApprovalStatusPayload>();
  if (!apIds.length) return out;

  const uniq = [...new Set(apIds.filter(Boolean))];

  const [apRows, policyRows] = await Promise.all([
    db
      .select({
        id: financeApPaymentRequests.id,
        amount: financeApPaymentRequests.amount,
        status: financeApPaymentRequests.status,
      })
      .from(financeApPaymentRequests)
      .where(inArray(financeApPaymentRequests.id, uniq)),
    db.select().from(financeApprovalPolicies),
  ]);

  const apMap = new Map(apRows.map((r) => [r.id, r]));

  const eventsRows = await db
    .select({
      documentId: financeApprovalEvents.documentId,
      stepIndex: financeApprovalEvents.stepIndex,
    })
    .from(financeApprovalEvents)
    .where(
      and(
        eq(financeApprovalEvents.documentType, DOCUMENT_TYPE_AP_PAYMENT),
        inArray(financeApprovalEvents.documentId, uniq)
      )
    );

  const eventsByDoc = new Map<string, number[]>();
  for (const e of eventsRows) {
    const prev = eventsByDoc.get(e.documentId) ?? [];
    prev.push(e.stepIndex);
    eventsByDoc.set(e.documentId, prev);
  }

  for (const id of uniq) {
    const ap = apMap.get(id);
    if (!ap || ap.status !== "Draft") {
      out.set(id, {
        id,
        policyId: null,
        policyName: null,
        totalSteps: 0,
        completedSteps: 0,
        steps: [],
        canSignNextStep: false,
        canFinalizeConfirm: true,
      });
      continue;
    }

    const amount = num(String(ap.amount));
    const policy = pickFinanceApprovalPolicy(policyRows, DOCUMENT_TYPE_AP_PAYMENT, amount);
    const steps = policy?.steps ?? [];
    const totalSteps = steps.length;
    const doneSet = completedStepIndexes(eventsByDoc.get(id) ?? []);
    const missing = nextMissingStepIndex(totalSteps, doneSet);
    const stepUi = steps.map((s, index) => ({
      index,
      label: s.label,
      done: doneSet.has(index),
      roleSlugs: s.roleSlugs,
    }));
    const canBypass = canBypassFinanceApproval(session);
    const fully = totalSteps === 0 || isApprovalFullyDone(totalSteps, doneSet);
    const nextStep = missing != null ? steps[missing] : undefined;
    const canSignNext =
      !!session?.user?.id && missing != null && canUserSignStep(session, nextStep);

    out.set(id, {
      id,
      policyId: policy?.id ?? null,
      policyName: policy?.name ?? null,
      totalSteps,
      completedSteps: doneSet.size,
      steps: stepUi,
      canSignNextStep: canSignNext,
      canFinalizeConfirm: canBypass || fully,
    });
  }

  return out;
}
