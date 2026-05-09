import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeArAdvanceReceipts, salesContracts } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import {
  createCommissionAccrualOnAdvanceReceived,
  moveCommissionAccrualsContractForAdvanceReceipt,
} from "@/lib/sales/commission-accrual";

export const runtime = "nodejs";

function sameCustomer(
  a: { customerId: string | null; customerName: string },
  b: { customerId: string | null; customerName: string }
): boolean {
  if (a.customerId && b.customerId) return a.customerId === b.customerId;
  return a.customerName.trim() === b.customerName.trim();
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm_receive") }),
  z.object({
    action: z.literal("assign_contract"),
    salesContractId: z.string().uuid(),
  }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "id 須為有效 UUID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "參數錯誤", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const db = getDb();

    if (parsed.data.action === "confirm_receive") {
      const [upd] = await db
        .update(financeArAdvanceReceipts)
        .set({
          status: "Received",
          receivedAt: new Date(),
        })
        .where(
          and(eq(financeArAdvanceReceipts.id, idParsed.data), eq(financeArAdvanceReceipts.status, "Draft"))
        )
        .returning({ id: financeArAdvanceReceipts.id });

      if (!upd) {
        return NextResponse.json({ error: "僅草稿可確認收款，或單據不存在" }, { status: 409 });
      }

      try {
        await createCommissionAccrualOnAdvanceReceived(db, idParsed.data);
      } catch (ce) {
        console.error("[PATCH ar-advance-receipts confirm_receive] commission accrual", ce);
      }

      return NextResponse.json({ ok: true });
    }

    if (parsed.data.action === "assign_contract") {
      const [ar] = await db
        .select({
          id: financeArAdvanceReceipts.id,
          salesContractId: financeArAdvanceReceipts.salesContractId,
        })
        .from(financeArAdvanceReceipts)
        .where(eq(financeArAdvanceReceipts.id, idParsed.data))
        .limit(1);

      if (!ar) {
        return NextResponse.json({ error: "預收款單不存在" }, { status: 404 });
      }

      if (ar.salesContractId === parsed.data.salesContractId) {
        return NextResponse.json({ ok: true, noop: true });
      }

      const [oldCt] = await db
        .select({
          id: salesContracts.id,
          customerId: salesContracts.customerId,
          customerName: salesContracts.customerName,
        })
        .from(salesContracts)
        .where(eq(salesContracts.id, ar.salesContractId))
        .limit(1);

      const [newCt] = await db
        .select({
          id: salesContracts.id,
          customerId: salesContracts.customerId,
          customerName: salesContracts.customerName,
        })
        .from(salesContracts)
        .where(eq(salesContracts.id, parsed.data.salesContractId))
        .limit(1);

      if (!oldCt || !newCt) {
        return NextResponse.json({ error: "銷售合同不存在" }, { status: 404 });
      }

      if (!sameCustomer(oldCt, newCt)) {
        return NextResponse.json(
          { error: "僅可改掛至同一客戶的銷售合同，請檢查客戶是否一致" },
          { status: 400 }
        );
      }

      await db
        .update(financeArAdvanceReceipts)
        .set({ salesContractId: parsed.data.salesContractId })
        .where(eq(financeArAdvanceReceipts.id, idParsed.data));

      try {
        await moveCommissionAccrualsContractForAdvanceReceipt(db, idParsed.data, parsed.data.salesContractId);
      } catch (me) {
        console.error("[PATCH ar-advance-receipts assign_contract] move commission accruals", me);
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "不支援的操作" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PATCH /api/finance/ar-advance-receipts/[id]]", msg);
    return NextResponse.json(
      { error: "無法更新預收款單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "id 須為有效 UUID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [del] = await db
      .delete(financeArAdvanceReceipts)
      .where(and(eq(financeArAdvanceReceipts.id, idParsed.data), eq(financeArAdvanceReceipts.status, "Draft")))
      .returning({ id: financeArAdvanceReceipts.id });

    if (!del) {
      return NextResponse.json({ error: "僅草稿可刪除，或單據不存在" }, { status: 409 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[DELETE /api/finance/ar-advance-receipts/[id]]", msg);
    return NextResponse.json(
      { error: "無法刪除預收款單", detail: process.env.NODE_ENV !== "production" ? msg : undefined },
      { status: 500 }
    );
  }
}
