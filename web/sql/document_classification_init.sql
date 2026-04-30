-- 文件分類字典表與系統文件主表（File Management — 文件分類）
-- Neon SQL Editor 可貼上執行；本機 web 目錄建議：npm run db:apply:document-classification-init

CREATE TABLE IF NOT EXISTS document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(256) NOT NULL UNIQUE,
  description VARCHAR(512),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR(512) NOT NULL,
  file_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES document_categories (id) ON DELETE RESTRICT,
  entity_type VARCHAR(64),
  entity_id UUID,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_documents_category_id_idx ON system_documents (category_id);
CREATE INDEX IF NOT EXISTS system_documents_entity_type_idx ON system_documents (entity_type);
CREATE INDEX IF NOT EXISTS system_documents_entity_idx ON system_documents (entity_type, entity_id);
