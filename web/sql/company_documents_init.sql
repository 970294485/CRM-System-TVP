/* 企業文檔／公共文件數據庫（與 system_documents 分離）；web 目錄：npm run db:apply:company-documents-init */

CREATE TABLE IF NOT EXISTS company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  title varchar(512) NOT NULL,
  category varchar(128) NOT NULL,
  file_url text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  access_type varchar(32) NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_documents_access_type_check CHECK (access_type IN ('PUBLIC', 'RESTRICTED'))
);

CREATE TABLE IF NOT EXISTS company_document_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  document_id uuid NOT NULL REFERENCES public.company_documents (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
