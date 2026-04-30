-- 客服案件與備註（服務管理）
CREATE TABLE IF NOT EXISTS customer_service_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_no text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers (id) ON DELETE SET NULL,
  customer_name_snapshot text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'inquiry',
  channel text NOT NULL DEFAULT 'other',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  summary text,
  assigned_to_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_service_cases_category_check CHECK (
    category IN ('inquiry', 'complaint', 'after_sales', 'billing', 'other')
  ),
  CONSTRAINT customer_service_cases_channel_check CHECK (
    channel IN ('phone', 'email', 'line', 'in_person', 'online', 'other')
  ),
  CONSTRAINT customer_service_cases_status_check CHECK (
    status IN ('open', 'in_progress', 'resolved', 'closed')
  ),
  CONSTRAINT customer_service_cases_priority_check CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS customer_service_cases_customer_idx ON customer_service_cases (customer_id);

CREATE INDEX IF NOT EXISTS customer_service_cases_status_idx ON customer_service_cases (status);

CREATE INDEX IF NOT EXISTS customer_service_cases_opened_at_idx ON customer_service_cases (opened_at DESC);

CREATE TABLE IF NOT EXISTS customer_service_case_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  case_id uuid NOT NULL REFERENCES customer_service_cases (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_service_case_notes_case_idx ON customer_service_case_notes (case_id, created_at DESC);
