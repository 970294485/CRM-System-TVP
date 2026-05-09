import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { financeArAdvanceReceipts, salesCommissionAccruals, salesContracts } from "@/db/schema";

type DbClient = ReturnType<typeof getDb>;

function num(v: string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 預收款狀態為已收款後呼叫：若合同有業務與佣金比例則寫入一筆計提（同一預收款不重複） */
export async function createCommissionAccrualOnAdvanceReceived(db: DbClient, advanceReceiptId: string): Promise<void> {
  const [rec] = await db
    .select({
      id: financeArAdvanceReceipts.id,
      salesContractId: financeArAdvanceReceipts.salesContractId,
      amount: financeArAdvanceReceipts.amount,
      status: financeArAdvanceReceipts.status,
    })
    .from(financeArAdvanceReceipts)
    .where(eq(financeArAdvanceReceipts.id, advanceReceiptId))
    .limit(1);

  if (!rec || rec.status !== "Received") return;

  const base = num(String(rec.amount));
  if (base <= 0) return;

  const [contract] = await db
    .select({
      ownerUserId: salesContracts.ownerUserId,
      commissionRatePercent: salesContracts.commissionRatePercent,
    })
    .from(salesContracts)
    .where(eq(salesContracts.id, rec.salesContractId))
    .limit(1);

  if (!contract?.ownerUserId) return;

  const rate = num(contract.commissionRatePercent != null ? String(contract.commissionRatePercent) : "");
  if (rate <= 0) return;

  const commission = roundMoney((base * rate) / 100);
  if (commission <= 0) return;

  try {
    await db.insert(salesCommissionAccruals).values({
      contractId: rec.salesContractId,
      beneficiaryUserId: contract.ownerUserId,
      basis: "advance_receipt",
      ratePercent: String(rate),
      baseAmount: String(roundMoney(base)),
      commissionAmount: String(commission),
      advanceReceiptId: rec.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) return;
    throw e;
  }
}

/** 預收款改掛合同時，同步已計提列之 contract_id */
export async function moveCommissionAccrualsContractForAdvanceReceipt(
  db: DbClient,
  advanceReceiptId: string,
  newContractId: string
): Promise<void> {
  await db
    .update(salesCommissionAccruals)
    .set({ contractId: newContractId })
    .where(eq(salesCommissionAccruals.advanceReceiptId, advanceReceiptId));
}
