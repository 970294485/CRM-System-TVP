import { getNeonSql } from "@/db";
import { normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";

/** 與 GET /api/sales/contracts 列表項目一致 */
export type SalesContractListItem = {
  id: string;
  contractNo: string;
  sourceQuoteNo: string | null;
  quotationId: string | null;
  customerId: string | null;
  customerName: string;
  contractDate: string;
  totalAmount: string;
  prepaymentAmount: string | null;
  prepaymentNotes: string | null;
  status: string;
  createdAt: string;
  proformaInvoiceNo: string | null;
};

type RowExtended = {
  id: string;
  contract_no: string;
  source_quote_no: string | null;
  quotation_id: string | null;
  customer_id: string | null;
  customer_name: string;
  contract_date: string;
  total_amount: string;
  prepayment_amount: string | null;
  prepayment_notes: string | null;
  status: string;
  created_at: string;
  proforma_invoice_no: string | null;
};

type RowMinimal = {
  id: string;
  contract_no: string;
  source_quote_no: string | null;
  quotation_id: string | null;
  customer_id: string | null;
  customer_name: string;
  contract_date: string;
  total_amount: string;
  status: string;
  created_at: string;
};

function mapExtended(r: RowExtended): SalesContractListItem {
  return {
    id: r.id,
    contractNo: r.contract_no,
    sourceQuoteNo: r.source_quote_no,
    quotationId: r.quotation_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    contractDate: r.contract_date,
    totalAmount: r.total_amount,
    prepaymentAmount: r.prepayment_amount,
    prepaymentNotes: r.prepayment_notes,
    status: r.status,
    createdAt: r.created_at,
    proformaInvoiceNo: r.proforma_invoice_no,
  };
}

function mapMinimal(r: RowMinimal): SalesContractListItem {
  return {
    id: r.id,
    contractNo: r.contract_no,
    sourceQuoteNo: r.source_quote_no,
    quotationId: r.quotation_id,
    customerId: r.customer_id,
    customerName: r.customer_name,
    contractDate: r.contract_date,
    totalAmount: r.total_amount,
    prepaymentAmount: null,
    prepaymentNotes: null,
    status: r.status,
    createdAt: r.created_at,
    proformaInvoiceNo: null,
  };
}

/**
 * Drizzle 因缺欄／缺 proforma_invoices 表失敗時，用原生 SQL 列表。
 * 先嘗試含預收款與預收發票 JOIN；失敗則僅查基底欄位。
 */
export async function listSalesContractsViaNeonSql(customerId?: string): Promise<SalesContractListItem[]> {
  const sql = getNeonSql();
  const orderBy = `ORDER BY sc.contract_date DESC NULLS LAST, sc.contract_no ASC`;

  const extended = `
    SELECT sc.id, sc.contract_no, sc.source_quote_no, sc.quotation_id, sc.customer_id, sc.customer_name,
           sc.contract_date::text AS contract_date, sc.total_amount::text AS total_amount,
           sc.prepayment_amount::text AS prepayment_amount, sc.prepayment_notes,
           sc.status, sc.created_at::text AS created_at,
           pi.invoice_no AS proforma_invoice_no
    FROM sales_contracts sc
    LEFT JOIN proforma_invoices pi ON pi.contract_id = sc.id
  `;

  try {
    const raw = customerId
      ? await sql.query(`${extended} WHERE sc.customer_id = $1::uuid ${orderBy}`, [customerId])
      : await sql.query(`${extended} ${orderBy}`, []);
    const rows = normalizeNeonRows<RowExtended>(raw);
    return rows.map(mapExtended);
  } catch {
    const minimal = `
      SELECT sc.id, sc.contract_no, sc.source_quote_no, sc.quotation_id, sc.customer_id, sc.customer_name,
             sc.contract_date::text AS contract_date, sc.total_amount::text AS total_amount,
             sc.status, sc.created_at::text AS created_at
      FROM sales_contracts sc
    `;
    const raw2 = customerId
      ? await sql.query(`${minimal} WHERE sc.customer_id = $1::uuid ${orderBy}`, [customerId])
      : await sql.query(`${minimal} ${orderBy}`, []);
    const rows2 = normalizeNeonRows<RowMinimal>(raw2);
    return rows2.map(mapMinimal);
  }
}
