import { getNeonSql } from "@/db";
import { normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";

/** 與 GET /api/finance/ap-payment-requests 列表項目一致 */
export type ApPaymentRequestListItem = {
  id: string;
  documentNo: string;
  purchaseOrderId: string;
  amount: string;
  requestDate: string;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  poNo: string;
  poTotal: string;
  poPaid: string;
  poPaymentStatus: string;
  supplierName: string | null;
};

type RawRow = {
  id: string;
  document_no: string;
  purchase_order_id: string;
  amount: string;
  request_date: string;
  status: string;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  po_no: string;
  po_total: string;
  po_paid: string;
  po_payment_status: string;
  supplier_name: string | null;
};

function mapRow(r: RawRow): ApPaymentRequestListItem {
  return {
    id: r.id,
    documentNo: r.document_no,
    purchaseOrderId: r.purchase_order_id,
    amount: r.amount,
    requestDate: r.request_date,
    status: r.status,
    notes: r.notes,
    confirmedAt: r.confirmed_at,
    createdAt: r.created_at,
    poNo: r.po_no,
    poTotal: r.po_total,
    poPaid: r.po_paid,
    poPaymentStatus: r.po_payment_status,
    supplierName: r.supplier_name,
  };
}

/**
 * 以 Neon `sql.query` 讀取應付請款單列表。
 * 舊庫若未跑 `sql/purchase_orders_customer_columns.sql` 會沒有 `purchase_orders.customer_name`，改以 customers 左連接或略過名稱。
 */
export async function listApPaymentRequestsViaNeonSql(): Promise<ApPaymentRequestListItem[]> {
  const sql = getNeonSql();
  const orderBy = `ORDER BY f.created_at DESC NULLS LAST, f.document_no ASC`;
  const selectCore = `
    SELECT
      f.id,
      f.document_no,
      f.purchase_order_id,
      f.amount::text AS amount,
      f.request_date::text AS request_date,
      f.status,
      f.notes,
      f.confirmed_at::text AS confirmed_at,
      f.created_at::text AS created_at,
      po.po_no,
      po.total_amount::text AS po_total,
      po.paid_amount::text AS po_paid,
      po.payment_status AS po_payment_status`;

  const attempts: { join: string; supplierExpr: string }[] = [
    { join: "", supplierExpr: "po.customer_name AS supplier_name" },
    {
      join: "LEFT JOIN customers c ON c.id = po.customer_id",
      supplierExpr: "c.name AS supplier_name",
    },
    { join: "", supplierExpr: "NULL::text AS supplier_name" },
  ];

  let lastErr: unknown;
  for (const a of attempts) {
    try {
      const q = `${selectCore},
      ${a.supplierExpr}
    FROM finance_ap_payment_requests f
    INNER JOIN purchase_orders po ON po.id = f.purchase_order_id
    ${a.join}
    ${orderBy}`;
      const raw = await sql.query(q, []);
      const rows = normalizeNeonRows<RawRow>(raw);
      return rows.map(mapRow);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/column .* does not exist/i.test(msg)) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
