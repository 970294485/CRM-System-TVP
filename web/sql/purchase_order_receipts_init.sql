-- =============================================================================
-- 採購入庫明細：連結 purchase_orders 與 products／庫存異動依據
-- 由 npm run db:apply:documents-init 一併執行
-- =============================================================================

CREATE TABLE IF NOT EXISTS purchase_order_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  sku varchar NOT NULL,
  warehouse_location varchar,
  qty_received integer NOT NULL,
  unit_cost numeric(10, 2),
  line_name_snapshot varchar,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS purchase_order_receipts_po_idx ON purchase_order_receipts (purchase_order_id);
CREATE INDEX IF NOT EXISTS purchase_order_receipts_product_idx ON purchase_order_receipts (product_id);
