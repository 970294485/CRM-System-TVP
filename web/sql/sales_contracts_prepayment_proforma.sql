-- 銷售合同：預收款欄位 + 預收發票表
-- web/: npm run db:apply:contracts-prepayment

ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS prepayment_amount numeric(12, 2);
ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS prepayment_notes text;

CREATE TABLE IF NOT EXISTS proforma_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no varchar NOT NULL UNIQUE,
  contract_id uuid NOT NULL UNIQUE REFERENCES sales_contracts (id) ON DELETE CASCADE,
  source_contract_no varchar NOT NULL,
  customer_id uuid REFERENCES customers (id) ON DELETE SET NULL,
  customer_name varchar NOT NULL,
  customer_phone varchar,
  customer_email varchar,
  issue_date date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12, 2),
  tax_rate numeric(5, 2),
  tax_amount numeric(12, 2),
  total_amount numeric(12, 2) NOT NULL,
  status varchar NOT NULL DEFAULT 'Issued',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proforma_invoices_issue_date_idx ON proforma_invoices (issue_date DESC);
CREATE INDEX IF NOT EXISTS proforma_invoices_customer_id_idx ON proforma_invoices (customer_id);
