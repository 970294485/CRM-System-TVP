import { getNeonSql } from "@/db";

import { normalizeNeonRows } from "@/lib/sales/quotations-list-fallback";

export type DeliveryNoteListItem = {
  id: string;
  dnNo: string;
  contractId: string;
  sourceContractNo: string;
  customerName: string;
  shipDate: string;
  status: string;
  createdAt: string;
};

type RawRow = {
  id: string;
  dn_no: string;
  contract_id: string;
  source_contract_no: string;
  customer_name: string;
  ship_date: string;
  status: string;
  created_at: string;
};

/** Drizzle 失敗時改用原生 SQL 列表（表須已存在）。 */
export async function listDeliveryNotesViaNeonSql(): Promise<DeliveryNoteListItem[]> {
  const sql = getNeonSql();
  const raw = await sql.query(
    `SELECT id,
            dn_no,
            contract_id,
            source_contract_no,
            customer_name,
            ship_date::text AS ship_date,
            status,
            created_at::text AS created_at
     FROM delivery_notes
     ORDER BY ship_date DESC`,
    []
  );
  const rows = normalizeNeonRows<RawRow>(raw);
  return rows.map((r) => ({
    id: r.id,
    dnNo: r.dn_no,
    contractId: r.contract_id,
    sourceContractNo: r.source_contract_no,
    customerName: r.customer_name,
    shipDate: r.ship_date?.slice(0, 10) ?? String(r.ship_date ?? ""),
    status: r.status,
    createdAt: r.created_at,
  }));
}

export function isDeliveryNotesTableMissingError(message: string): boolean {
  return /relation ["']?delivery_notes["']? does not exist|delivery_notes.*does not exist|UndefinedTable.*delivery_notes/i.test(
    message
  );
}
