-- 模組1：月度支出預算上限（採購單月度承諾額對照）；npm run db:apply:finance-expenditure-budget
CREATE TABLE IF NOT EXISTS finance_monthly_expenditure_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month VARCHAR(7) NOT NULL,
  cap_amount NUMERIC(15, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT finance_monthly_expenditure_budgets_year_month_ck CHECK (
    year_month ~ '^\d{4}-(0[1-9]|1[0-2])$'
  ),
  CONSTRAINT finance_monthly_expenditure_budgets_cap_ck CHECK (cap_amount >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_monthly_expenditure_budgets_year_month_uidx
  ON finance_monthly_expenditure_budgets (year_month);
