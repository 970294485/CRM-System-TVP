-- 模組1：應付請款單、預收款單（掛鉤採購單／銷售合同）
-- web/: npm run db:apply:finance-payment-advance

CREATE TABLE IF NOT EXISTS finance_ap_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  document_no text NOT NULL UNIQUE,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL,
  request_date date NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  confirmed_at timestamptz,
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT finance_ap_payment_requests_status_check CHECK (status IN ('Draft', 'Confirmed'))
);

CREATE TABLE IF NOT EXISTS finance_ar_advance_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  document_no text NOT NULL UNIQUE,
  sales_contract_id uuid NOT NULL REFERENCES sales_contracts (id) ON DELETE RESTRICT,
  amount numeric(12, 2) NOT NULL,
  receipt_date date NOT NULL,
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  received_at timestamptz,
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT finance_ar_advance_receipts_status_check CHECK (status IN ('Draft', 'Received'))
);

CREATE INDEX IF NOT EXISTS finance_ap_payment_requests_po_id_idx ON finance_ap_payment_requests (purchase_order_id);
CREATE INDEX IF NOT EXISTS finance_ar_advance_receipts_contract_id_idx ON finance_ar_advance_receipts (sales_contract_id);
