import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { customers, proformaInvoices } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const { id: rawId } = await ctx.params;
  const idParsed = z.string().uuid().safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "無效的預收發票 id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: proformaInvoices.id,
        invoiceNo: proformaInvoices.invoiceNo,
        contractId: proformaInvoices.contractId,
        sourceContractNo: proformaInvoices.sourceContractNo,
        customerId: proformaInvoices.customerId,
        customerName: proformaInvoices.customerName,
        customerPhone: proformaInvoices.customerPhone,
        customerEmail: proformaInvoices.customerEmail,
        issueDate: proformaInvoices.issueDate,
        items: proformaInvoices.items,
        subtotal: proformaInvoices.subtotal,
        taxRate: proformaInvoices.taxRate,
        taxAmount: proformaInvoices.taxAmount,
        totalAmount: proformaInvoices.totalAmount,
        status: proformaInvoices.status,
        notes: proformaInvoices.notes,
        createdAt: proformaInvoices.createdAt,
        customerCode: customers.customerCode,
        contactName: customers.contactName,
        customerAddress: customers.address,
      })
      .from(proformaInvoices)
      .leftJoin(customers, eq(proformaInvoices.customerId, customers.id))
      .where(eq(proformaInvoices.id, idParsed.data))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "找不到預收發票" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        id: row.id,
        invoiceNo: row.invoiceNo,
        contractId: row.contractId,
        sourceContractNo: row.sourceContractNo,
        customerId: row.customerId,
        customerName: row.customerName,
        customerPhone: row.customerPhone,
        customerEmail: row.customerEmail,
        issueDate: row.issueDate,
        items: row.items,
        subtotal: row.subtotal,
        taxRate: row.taxRate,
        taxAmount: row.taxAmount,
        totalAmount: row.totalAmount,
        status: row.status,
        notes: row.notes,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        customerCode: row.customerCode ?? null,
        contactName: row.contactName ?? null,
        customerAddress: row.customerAddress ?? null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sales/proforma-invoices/[id]]", msg);
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
