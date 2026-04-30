-- 個人網盤內部分享（依 system_documents）
CREATE TABLE IF NOT EXISTS system_document_personal_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES system_documents(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT system_document_personal_shares_permission_check CHECK (permission IN ('view', 'download'))
);

CREATE UNIQUE INDEX IF NOT EXISTS system_document_personal_shares_document_user_uidx
  ON system_document_personal_shares (document_id, shared_with_user_id);

CREATE INDEX IF NOT EXISTS idx_system_document_personal_shares_shared_with
  ON system_document_personal_shares (shared_with_user_id);
