-- 銷售合同：業務負責人與佣金比例；佣金計提明細（預收款確認時寫入）
-- web/: npm run db:apply:sales-finance-commission

ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE sales_contracts ADD COLUMN IF NOT EXISTS commission_rate_percent numeric(5, 2);

CREATE TABLE IF NOT EXISTS sales_commission_accruals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  contract_id uuid NOT NULL REFERENCES sales_contracts (id) ON DELETE CASCADE,
  beneficiary_user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  basis text NOT NULL,
  rate_percent numeric(5, 2) NOT NULL,
  base_amount numeric(12, 2) NOT NULL,
  commission_amount numeric(12, 2) NOT NULL,
  advance_receipt_id uuid REFERENCES finance_ar_advance_receipts (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_commission_accruals_basis_check CHECK (basis IN ('advance_receipt'))
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_commission_accruals_adv_rcpt_uidx ON sales_commission_accruals (advance_receipt_id)
WHERE
  advance_receipt_id IS NOT NULL;
