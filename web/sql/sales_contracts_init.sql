-- 銷售合同（可由報價單一鍵轉換）
-- web/: npm run db:apply:sales-contracts

CREATE TABLE IF NOT EXISTS sales_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_no varchar NOT NULL UNIQUE,
  source_quote_no varchar,
  quotation_id uuid UNIQUE REFERENCES quotations (id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers (id) ON DELETE RESTRICT,
  customer_name varchar NOT NULL,
  customer_phone varchar,
  customer_email varchar,
  contract_date date NOT NULL,
  valid_until date,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12, 2),
  tax_rate numeric(5, 2),
  tax_amount numeric(12, 2),
  total_amount numeric(12, 2) NOT NULL,
  status varchar NOT NULL DEFAULT 'Active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_contracts_customer_id_idx ON sales_contracts (customer_id);
CREATE INDEX IF NOT EXISTS sales_contracts_contract_date_idx ON sales_contracts (contract_date DESC);
