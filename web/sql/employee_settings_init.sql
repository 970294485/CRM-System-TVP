-- =============================================================================
-- 第一步：人事數據 — employee_settings（員工薪資與考勤設置）
-- =============================================================================
-- Neon SQL Editor 可整份執行；或於 web 目錄執行 migration 0008。
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS employee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name varchar NOT NULL,
  department varchar,
  base_salary numeric(10, 2),
  commission_rate numeric(5, 2),
  work_start_time time,
  work_end_time time,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 批量匯入暫存（報價／採購／庫存等，完整業務表未來再接續）
CREATE TABLE IF NOT EXISTS data_import_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type text NOT NULL,
  batch_id uuid NOT NULL,
  row_index integer NOT NULL,
  record jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS data_import_staging_batch_idx ON data_import_staging (batch_id);
