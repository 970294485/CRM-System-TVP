import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { getDb, getNeonSql } from "@/db";
import { proformaInvoices, salesContracts, users } from "@/db/schema";
import { normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";

/** 與 GET /api/sales/contracts/[id] 回傳 item 一致 */
export type SalesContractDetail = {
  id: string;
  contractNo: string;
  sourceQuoteNo: string | null;
  quotationId: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  contractDate: string;
  validUntil: string | null;
  items: unknown;
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  status: string;
  notes: string | null;
  prepaymentAmount: string | null;
  prepaymentNotes: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  commissionRatePercent: string | null;
  createdAt: string;
  proformaInvoiceNo: string | null;
};

function mapDrizzleRow(r: {
  id: string;
  contractNo: string;
  sourceQuoteNo: string | null;
  quotationId: string | null;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  contractDate: string;
  validUntil: string | null;
  items: unknown;
  subtotal: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  totalAmount: string;
  status: string;
  notes: string | null;
  prepaymentAmount: string | null;
  prepaymentNotes: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  commissionRatePercent: string | null;
  createdAt: Date;
  proformaInvoiceNo: string | null;
}): SalesContractDetail {
  return {
    id: r.id,
    contractNo: r.contractNo,
    sourceQuoteNo: r.sourceQuoteNo,
    quotationId: r.quotationId,
    customerId: r.customerId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    contractDate: r.contractDate,
    validUntil: r.validUntil,
    items: r.items,
    subtotal: r.subtotal,
    taxRate: r.taxRate,
    taxAmount: r.taxAmount,
    totalAmount: r.totalAmount,
    status: r.status,
    notes: r.notes,
    prepaymentAmount: r.prepaymentAmount,
    prepaymentNotes: r.prepaymentNotes,
    ownerUserId: r.ownerUserId,
    ownerName: r.ownerName,
    commissionRatePercent: r.commissionRatePercent,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    proformaInvoiceNo: r.proformaInvoiceNo,
  };
}

export async function loadSalesContractDetail(id: string): Promise<SalesContractDetail | null> {
  try {
    const db = getDb();
    const owner = alias(users, "sales_contract_owner");
    const [row] = await db
      .select({
        id: salesContracts.id,
        contractNo: salesContracts.contractNo,
        sourceQuoteNo: salesContracts.sourceQuoteNo,
        quotationId: salesContracts.quotationId,
        customerId: salesContracts.customerId,
        customerName: salesContracts.customerName,
        customerPhone: salesContracts.customerPhone,
        customerEmail: salesContracts.customerEmail,
        contractDate: salesContracts.contractDate,
        validUntil: salesContracts.validUntil,
        items: salesContracts.items,
        subtotal: salesContracts.subtotal,
        taxRate: salesContracts.taxRate,
        taxAmount: salesContracts.taxAmount,
        totalAmount: salesContracts.totalAmount,
        status: salesContracts.status,
        notes: salesContracts.notes,
        prepaymentAmount: salesContracts.prepaymentAmount,
        prepaymentNotes: salesContracts.prepaymentNotes,
        ownerUserId: salesContracts.ownerUserId,
        ownerName: owner.name,
        commissionRatePercent: salesContracts.commissionRatePercent,
        createdAt: salesContracts.createdAt,
        proformaInvoiceNo: proformaInvoices.invoiceNo,
      })
      .from(salesContracts)
      .leftJoin(proformaInvoices, eq(proformaInvoices.contractId, salesContracts.id))
      .leftJoin(owner, eq(salesContracts.ownerUserId, owner.id))
      .where(eq(salesContracts.id, id))
      .limit(1);

    if (!row) return null;
    return mapDrizzleRow({ ...row, items: row.items });
  } catch {
    return loadSalesContractDetailNeon(id);
  }
}

type NeonDetailExtended = {
  id: string;
  contract_no: string;
  source_quote_no: string | null;
  quotation_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  contract_date: string;
  valid_until: string | null;
  items: unknown;
  subtotal: string | null;
  tax_rate: string | null;
  tax_amount: string | null;
  total_amount: string;
  status: string;
  notes: string | null;
  prepayment_amount: string | null;
  prepayment_notes: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  commission_rate_percent: string | null;
  created_at: string;
  proforma_invoice_no: string | null;
};

type NeonDetailMinimal = {
  id: string;
  contract_no: string;
  source_quote_no: string | null;
  quotation_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  contract_date: string;
  valid_until: string | null;
  items: unknown;
  total_amount: string;
  status: string;
  created_at: string;
};

function mapNeonExtended(r: NeonDetailExtended): SalesContractDetail {
  return {
    id: r.id,
    contractNo: r.contract_no,
    sourceQuoteNo: r.source_quote_no,
    quotationId: r.quotation_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    customerEmail: r.customer_email,
    contractDate: r.contract_date,
    validUntil: r.valid_until,
    items: r.items,
    subtotal: r.subtotal,
    taxRate: r.tax_rate,
    taxAmount: r.tax_amount,
    totalAmount: r.total_amount,
    status: r.status,
    notes: r.notes,
    prepaymentAmount: r.prepayment_amount,
    prepaymentNotes: r.prepayment_notes,
    ownerUserId: r.owner_user_id,
    ownerName: r.owner_name,
    commissionRatePercent: r.commission_rate_percent,
    createdAt: r.created_at,
    proformaInvoiceNo: r.proforma_invoice_no,
  };
}

async function loadSalesContractDetailNeon(id: string): Promise<SalesContractDetail | null> {
  const sql = getNeonSql();
  const extended = `
    SELECT sc.id, sc.contract_no, sc.source_quote_no, sc.quotation_id, sc.customer_id, sc.customer_name,
           sc.customer_phone, sc.customer_email, sc.contract_date::text AS contract_date, sc.valid_until::text AS valid_until,
           sc.items, sc.subtotal::text AS subtotal, sc.tax_rate::text AS tax_rate, sc.tax_amount::text AS tax_amount,
           sc.total_amount::text AS total_amount, sc.status, sc.notes,
           sc.prepayment_amount::text AS prepayment_amount, sc.prepayment_notes,
           sc.owner_user_id::text AS owner_user_id, ou.name AS owner_name,
           sc.commission_rate_percent::text AS commission_rate_percent,
           sc.created_at::text AS created_at, pi.invoice_no AS proforma_invoice_no
    FROM sales_contracts sc
    LEFT JOIN proforma_invoices pi ON pi.contract_id = sc.id
    LEFT JOIN users ou ON ou.id = sc.owner_user_id
    WHERE sc.id = $1::uuid
    LIMIT 1
  `;
  try {
    const raw = await sql.query(extended, [id]);
    const rows = normalizeNeonRows<NeonDetailExtended>(raw);
    const r = rows[0];
    return r ? mapNeonExtended(r) : null;
  } catch {
    const minimal = `
      SELECT sc.id, sc.contract_no, sc.source_quote_no, sc.quotation_id, sc.customer_id, sc.customer_name,
             sc.customer_phone, sc.customer_email, sc.contract_date::text AS contract_date, sc.valid_until::text AS valid_until,
             sc.items, sc.total_amount::text AS total_amount, sc.status, sc.created_at::text AS created_at
      FROM sales_contracts sc
      WHERE sc.id = $1::uuid
      LIMIT 1
    `;
    const raw2 = await sql.query(minimal, [id]);
    const rows2 = normalizeNeonRows<NeonDetailMinimal>(raw2);
    const r2 = rows2[0];
    if (!r2) return null;
    return {
      id: r2.id,
      contractNo: r2.contract_no,
      sourceQuoteNo: r2.source_quote_no,
      quotationId: r2.quotation_id,
      customerId: r2.customer_id,
      customerName: r2.customer_name,
      customerPhone: r2.customer_phone,
      customerEmail: r2.customer_email,
      contractDate: r2.contract_date,
      validUntil: r2.valid_until,
      items: r2.items,
      subtotal: null,
      taxRate: null,
      taxAmount: null,
      totalAmount: r2.total_amount,
      status: r2.status,
      notes: null,
      prepaymentAmount: null,
      prepaymentNotes: null,
      ownerUserId: null,
      ownerName: null,
      commissionRatePercent: null,
      createdAt: r2.created_at,
      proformaInvoiceNo: null,
    };
  }
}
