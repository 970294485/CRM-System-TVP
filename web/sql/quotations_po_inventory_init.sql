-- =============================================================================
-- 報價單、採購單、庫存信息（PT-Data Entry）
-- Neon 可整份執行；或 web/: npm run db:apply:documents-init
-- =============================================================================

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_no varchar NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers (id) ON DELETE RESTRICT,
  customer_name varchar NOT NULL,
  customer_phone varchar,
  customer_email varchar,
  total_amount numeric(12, 2) NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  status varchar NOT NULL DEFAULT 'Legacy_Imported',
  quote_date date NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_no varchar NOT NULL UNIQUE,
  original_system_id varchar,
  total_amount numeric(12, 2) NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  po_date date NOT NULL,
  status varchar NOT NULL DEFAULT 'Legacy_Imported',
  payment_status varchar NOT NULL DEFAULT 'Unpaid',
  paid_amount numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT purchase_orders_payment_status_check CHECK (
    payment_status IN ('Unpaid', 'Partial', 'Paid')
  )
);

CREATE TABLE IF NOT EXISTS inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  sku varchar NOT NULL,
  warehouse_location varchar,
  stock_qty integer NOT NULL DEFAULT 0,
  unit_cost numeric(10, 2),
  last_counted_date date
);

CREATE INDEX IF NOT EXISTS inventory_product_id_idx ON inventory (product_id);
CREATE INDEX IF NOT EXISTS inventory_sku_idx ON inventory (sku);
