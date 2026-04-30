-- 服務管理：場地主檔與員工／場地預約（防時間重疊於應用層檢查）
-- web/: npm run db:apply:service-resource-booking-init

CREATE TABLE IF NOT EXISTS service_resource_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  name text NOT NULL,
  venue_type text NOT NULL DEFAULT 'room',
  capacity integer,
  location_note text,
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_resource_venues_venue_type_check CHECK (
    venue_type IN ('room', 'bay', 'event_space', 'equipment', 'other')
  )
);

CREATE INDEX IF NOT EXISTS service_resource_venues_active_idx ON service_resource_venues (is_active);

CREATE TABLE IF NOT EXISTS service_resource_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  title text NOT NULL,
  customer_service_case_id uuid REFERENCES customer_service_cases (id) ON DELETE SET NULL,
  staff_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  venue_id uuid REFERENCES service_resource_venues (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  purchase_note text,
  estimated_cost_minor integer,
  notes text,
  created_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_resource_bookings_time_order_check CHECK (ends_at > starts_at),
  CONSTRAINT service_resource_bookings_resource_present_check CHECK (
    staff_user_id IS NOT NULL OR venue_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS service_resource_bookings_starts_idx ON service_resource_bookings (starts_at DESC);

CREATE INDEX IF NOT EXISTS service_resource_bookings_staff_idx ON service_resource_bookings (staff_user_id)
WHERE
  staff_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS service_resource_bookings_venue_idx ON service_resource_bookings (venue_id)
WHERE
  venue_id IS NOT NULL;
