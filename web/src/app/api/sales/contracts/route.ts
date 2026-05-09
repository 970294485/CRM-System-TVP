import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getDb } from "@/db";
import { proformaInvoices, salesContracts, users } from "@/db/schema";
import { listSalesContractsViaNeonSql } from "@/lib/sales/contracts-list-fallback";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const rawCustomerId = req.nextUrl.searchParams.get("customerId");
  const customerIdParsed = rawCustomerId
    ? z.string().uuid().safeParse(rawCustomerId)
    : { success: true as const, data: undefined as string | undefined };
  if (!customerIdParsed.success) {
    return NextResponse.json({ error: "customerId 須為有效 UUID" }, { status: 400 });
  }

  try {
    const db = getDb();
    const owner = alias(users, "sales_contract_owner");
    const base = db
      .select({
        id: salesContracts.id,
        contractNo: salesContracts.contractNo,
        sourceQuoteNo: salesContracts.sourceQuoteNo,
        quotationId: salesContracts.quotationId,
        customerId: salesContracts.customerId,
        customerName: salesContracts.customerName,
        contractDate: salesContracts.contractDate,
        totalAmount: salesContracts.totalAmount,
        prepaymentAmount: salesContracts.prepaymentAmount,
        prepaymentNotes: salesContracts.prepaymentNotes,
        status: salesContracts.status,
        createdAt: salesContracts.createdAt,
        ownerUserId: salesContracts.ownerUserId,
        ownerName: owner.name,
        commissionRatePercent: salesContracts.commissionRatePercent,
        proformaInvoiceNo: proformaInvoices.invoiceNo,
      })
      .from(salesContracts)
      .leftJoin(proformaInvoices, eq(proformaInvoices.contractId, salesContracts.id))
      .leftJoin(owner, eq(salesContracts.ownerUserId, owner.id));

    const rows =
      customerIdParsed.data !== undefined
        ? await base.where(eq(salesContracts.customerId, customerIdParsed.data)).orderBy(desc(salesContracts.contractDate))
        : await base.orderBy(desc(salesContracts.contractDate));

    const items = rows.map((r) => ({
      id: r.id,
      contractNo: r.contractNo,
      sourceQuoteNo: r.sourceQuoteNo,
      quotationId: r.quotationId,
      customerId: r.customerId,
      customerName: r.customerName,
      contractDate: r.contractDate,
      totalAmount: r.totalAmount,
      prepaymentAmount: r.prepaymentAmount,
      prepaymentNotes: r.prepaymentNotes,
      status: r.status,
      createdAt: r.createdAt,
      ownerUserId: r.ownerUserId,
      ownerName: r.ownerName,
      commissionRatePercent: r.commissionRatePercent,
      proformaInvoiceNo: r.proformaInvoiceNo,
    }));

    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const items = await listSalesContractsViaNeonSql(customerIdParsed.data);
      console.warn("[GET /api/sales/contracts] Drizzle 失敗，已改用 SQL 列表:", msg);
      return NextResponse.json({ items });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      console.error("[GET /api/sales/contracts]", msg, msg2);
      return NextResponse.json(
        {
          error: "無法讀取銷售合同",
          detail: process.env.NODE_ENV !== "production" ? `${msg} | ${msg2}` : undefined,
          hint: /sales_contracts|does not exist/i.test(`${msg}${msg2}`)
            ? "請執行 npm run db:apply:sales-contracts；若需預收款／預收發票再加 npm run db:apply:contracts-prepayment"
            : undefined,
        },
        { status: 500 }
      );
    }
  }
}
