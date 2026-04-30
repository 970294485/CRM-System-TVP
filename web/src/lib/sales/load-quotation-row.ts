import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { customers, quotations, type QuotationLineItem } from "@/db/schema";
import { getQuotationByIdViaLegacySql } from "@/lib/sales/quotations-list-fallback";

/** 供轉合同等流程載入單筆報價（Drizzle 失敗時降級 legacy SQL） */
export type QuotationRowForConvert = {
  id: string;
  quoteNo: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  quoteDate: string;
  validUntil: string | null;
  items: QuotationLineItem[];
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  status: string;
  notes: string | null;
};

export async function loadQuotationRowForConvert(id: string): Promise<QuotationRowForConvert | null> {
  try {
    const db = getDb();
    const [row] = await db
      .select({
        id: quotations.id,
        quoteNo: quotations.quoteNo,
        customerId: quotations.customerId,
        customerName: quotations.customerName,
        customerPhone: quotations.customerPhone,
        customerEmail: quotations.customerEmail,
        quoteDate: quotations.quoteDate,
        validUntil: quotations.validUntil,
        items: quotations.items,
        subtotal: quotations.subtotal,
        taxRate: quotations.taxRate,
        taxAmount: quotations.taxAmount,
        totalAmount: quotations.totalAmount,
        status: quotations.status,
        notes: quotations.notes,
        joinedCustomerName: customers.name,
      })
      .from(quotations)
      .leftJoin(customers, eq(quotations.customerId, customers.id))
      .where(eq(quotations.id, id))
      .limit(1);

    if (!row) return null;

    return {
      id: row.id,
      quoteNo: row.quoteNo,
      customerId: row.customerId,
      customerName: row.joinedCustomerName ?? row.customerName,
      customerPhone: row.customerPhone,
      customerEmail: row.customerEmail,
      quoteDate: row.quoteDate,
      validUntil: row.validUntil,
      items: Array.isArray(row.items) ? row.items : [],
      subtotal: row.subtotal,
      taxRate: row.taxRate,
      taxAmount: row.taxAmount,
      totalAmount: row.totalAmount,
      status: row.status,
      notes: row.notes,
    };
  } catch {
    const legacy = await getQuotationByIdViaLegacySql(id);
    if (!legacy) return null;
    const items = Array.isArray(legacy.items) ? legacy.items : [];
    return {
      id: legacy.id,
      quoteNo: legacy.quoteNo,
      customerId: legacy.customerId,
      customerName: legacy.customerName,
      customerPhone: legacy.customerPhone,
      customerEmail: legacy.customerEmail,
      quoteDate: legacy.quoteDate,
      validUntil: legacy.validUntil,
      items,
      subtotal: legacy.subtotal,
      taxRate: legacy.taxRate,
      taxAmount: legacy.taxAmount,
      totalAmount: legacy.totalAmount,
      status: legacy.status,
      notes: legacy.notes,
    };
  }
}
