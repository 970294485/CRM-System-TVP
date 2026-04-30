-- 模組1：多層審批策略與單據核准紀錄（與模組 9 角色 slug 對齊）
-- npm run db:apply:finance-approval

CREATE TABLE IF NOT EXISTS finance_approval_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document_type VARCHAR(64) NOT NULL,
  amount_min NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  steps JSONB NOT NULL DEFAULT '[]'::JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS finance_approval_policies_doc_type_idx ON finance_approval_policies (document_type);
CREATE INDEX IF NOT EXISTS finance_approval_policies_active_idx ON finance_approval_policies (is_active);

CREATE TABLE IF NOT EXISTS finance_approval_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type VARCHAR(64) NOT NULL,
  document_id UUID NOT NULL,
  step_index INTEGER NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS finance_approval_events_doc_step_uidx
  ON finance_approval_events (document_type, document_id, step_index);

CREATE INDEX IF NOT EXISTS finance_approval_events_document_idx
  ON finance_approval_events (document_type, document_id);
