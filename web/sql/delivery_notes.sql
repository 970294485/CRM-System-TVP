-- 送貨單（由銷售合同快照開立；取號鍵 delivery_note，預設前綴 DN-）
-- web/: npm run db:apply:delivery-notes

CREATE TABLE IF NOT EXISTS delivery_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  dn_no varchar NOT NULL UNIQUE,
  contract_id uuid NOT NULL REFERENCES sales_contracts (id) ON DELETE RESTRICT,
  source_contract_no varchar NOT NULL,
  customer_id uuid REFERENCES customers (id) ON DELETE SET NULL,
  customer_name varchar NOT NULL,
  customer_phone varchar,
  customer_email varchar,
  ship_to_address text,
  ship_date date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status varchar NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_notes_ship_date_idx ON delivery_notes (ship_date DESC);

CREATE INDEX IF NOT EXISTS delivery_notes_contract_id_idx ON delivery_notes (contract_id);
