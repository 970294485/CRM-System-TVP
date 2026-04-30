import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { proformaInvoices } from "@/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: proformaInvoices.id,
        invoiceNo: proformaInvoices.invoiceNo,
        contractId: proformaInvoices.contractId,
        sourceContractNo: proformaInvoices.sourceContractNo,
        customerName: proformaInvoices.customerName,
        issueDate: proformaInvoices.issueDate,
        totalAmount: proformaInvoices.totalAmount,
        status: proformaInvoices.status,
        createdAt: proformaInvoices.createdAt,
      })
      .from(proformaInvoices)
      .orderBy(desc(proformaInvoices.issueDate));

    return NextResponse.json({ items: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sales/proforma-invoices]", msg);
    return NextResponse.json(
      {
        error: "無法讀取預收發票",
        detail: process.env.NODE_ENV !== "production" ? msg : undefined,
        hint: /proforma_invoices|does not exist/i.test(msg) ? "請執行 npm run db:apply:contracts-prepayment" : undefined,
      },
      { status: 500 }
    );
  }
}
