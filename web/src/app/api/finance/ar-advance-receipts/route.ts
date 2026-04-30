import { desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { financeArAdvanceReceipts, proformaInvoices, salesContracts } from "@/db/schema";
import { canEditFinance } from "@/lib/authz";
import { suggestFinanceDocumentNo } from "@/lib/finance/suggest-document-no";

export const runtime = "nodejs";

const postSchema = z.object({
  documentNo: z.string().min(1).max(80).optional(),
  salesContractId: z.string().uuid(),
  amount: z.coerce.number().finite().positive(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(4000).optional().nullable(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: financeArAdvanceReceipts.id,
        documentNo: financeArAdvanceReceipts.documentNo,
        salesContractId: financeArAdvanceReceipts.salesContractId,
        amount: financeArAdvanceReceipts.amount,
        receiptDate: financeArAdvanceReceipts.receiptDate,
        status: financeArAdvanceReceipts.status,
        notes: financeArAdvanceReceipts.notes,
        receivedAt: financeArAdvanceReceipts.receivedAt,
        createdAt: financeArAdvanceReceipts.createdAt,
        contractNo: salesContracts.contractNo,
        contractTotal: salesContracts.totalAmount,
        customerId: salesContracts.customerId,
        customerName: salesContracts.customerName,
        proformaInvoiceNo: proformaInvoices.invoiceNo,
      })
      .from(financeArAdvanceReceipts)
      .innerJoin(salesContracts, eq(financeArAdvanceReceipts.salesContractId, salesContracts.id))
      .leftJoin(proformaInvoices, eq(proformaInvoices.contractId, salesContracts.id))
      .orderBy(desc(financeArAdvanceReceipts.createdAt));

    const items = rows.map((r) => ({
      id: r.id,
      documentNo: r.documentNo,
      salesContractId: r.salesContractId,
      amount: r.amount,
      receiptDate: r.receiptDate,
      status: r.status,
      notes: r.notes,
      receivedAt: r.receivedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      contractNo: r.contractNo,
      contractTotal: r.contractTotal,
      customerId: r.customerId ?? null,
      customerName: r.customerName,
      proformaInvoiceNo: r.proformaInvoiceNo ?? null,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/finance/ar-advance-receipts]", msg);
    return NextResponse.json(
      {
        error: "無法讀取預收款單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /finance_ar_advance_receipts|does not exist/i.test(msg)
          ? "請執行 npm run db:apply:finance-payment-advance（或 drizzle db:push）"
          : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }
  if (!canEditFinance(session)) {
    return NextResponse.json({ error: "無財務編輯權限" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "參數錯誤", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const documentNo = parsed.data.documentNo?.trim() || suggestFinanceDocumentNo("PR-AR");

  try {
    const db = getDb();
    const [ct] = await db
      .select({ id: salesContracts.id })
      .from(salesContracts)
      .where(eq(salesContracts.id, parsed.data.salesContractId))
      .limit(1);
    if (!ct) {
      return NextResponse.json({ error: "銷售合同不存在" }, { status: 404 });
    }

    const [inserted] = await db
      .insert(financeArAdvanceReceipts)
      .values({
        documentNo,
        salesContractId: parsed.data.salesContractId,
        amount: String(parsed.data.amount),
        receiptDate: parsed.data.receiptDate,
        notes: parsed.data.notes?.trim() || null,
        createdByUserId: session.user.id,
        status: "Draft",
      })
      .returning();

    return NextResponse.json({ item: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return NextResponse.json({ error: "單號重複，請改用其他文件編號" }, { status: 409 });
    }
    console.error("[POST /api/finance/ar-advance-receipts]", msg);
    return NextResponse.json(
      {
        error: "無法建立預收款單",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /finance_ar_advance_receipts|does not exist/i.test(msg)
          ? "請執行 npm run db:apply:finance-payment-advance"
          : undefined,
      },
      { status: 500 }
    );
  }
}
