-- ─────────────────────────────────────────────────────────────────────────────
-- 097  Casting Equipment Management System
-- Creates tables for the Role Room equipment inventory, booking, checkout
-- and template engines.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Equipment Inventory ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS casting_equipment (
  id              uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      varchar           NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name            varchar(255)      NOT NULL,
  brand           varchar(100),
  model           varchar(100),
  category        varchar(100),
  status          varchar(50)       NOT NULL DEFAULT 'available'
                                    CHECK (status IN ('available','in_use','maintenance','retired')),
  condition       varchar(50)       NOT NULL DEFAULT 'good'
                                    CHECK (condition IN ('excellent','good','fair','poor','needs_repair')),
  serial_number   varchar(150),
  purchase_date   date,
  purchase_price  numeric(12,2),
  rental_rate_day numeric(10,2),
  quantity        integer           NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  notes           text,
  image_url       text,
  vendor_url      text,
  is_global       boolean           NOT NULL DEFAULT false,
  tags            text[]            NOT NULL DEFAULT '{}',
  location        varchar(200),
  assignees       jsonb             NOT NULL DEFAULT '[]',
  booking_start   timestamptz,
  booking_end     timestamptz,
  metadata        jsonb             NOT NULL DEFAULT '{}',
  created_by      varchar,
  created_at      timestamptz       NOT NULL DEFAULT now(),
  updated_at      timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_casting_equipment_project   ON casting_equipment(project_id);
CREATE INDEX IF NOT EXISTS idx_casting_equipment_status    ON casting_equipment(status);
CREATE INDEX IF NOT EXISTS idx_casting_equipment_category  ON casting_equipment(category);
CREATE INDEX IF NOT EXISTS idx_casting_equipment_global    ON casting_equipment(is_global) WHERE is_global = true;

-- ── 2. Equipment Bookings ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_bookings (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  uuid          NOT NULL REFERENCES casting_equipment(id) ON DELETE CASCADE,
  project_id    varchar       NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  booked_by     varchar       NOT NULL,
  event_id      varchar,
  start_date    timestamptz   NOT NULL,
  end_date      timestamptz   NOT NULL,
  status        varchar(30)   NOT NULL DEFAULT 'confirmed'
                              CHECK (status IN ('confirmed','pending','cancelled')),
  quantity      integer       NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  notes         text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT equipment_bookings_date_order CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_equipment_bookings_equipment ON equipment_bookings(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_bookings_project   ON equipment_bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_equipment_bookings_dates     ON equipment_bookings(start_date, end_date);

-- ── 3. Equipment Checkouts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_checkouts (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id        uuid          NOT NULL REFERENCES casting_equipment(id) ON DELETE CASCADE,
  project_id          varchar       NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  checked_out_to      varchar       NOT NULL,
  checked_out_by      varchar,
  checked_out_at      timestamptz   NOT NULL DEFAULT now(),
  checked_in_at       timestamptz,
  quantity            integer       NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  purpose             text,
  condition_on_return varchar(50)
                      CHECK (condition_on_return IN ('excellent','good','fair','poor','needs_repair')),
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_equipment ON equipment_checkouts(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_project   ON equipment_checkouts(project_id);
CREATE INDEX IF NOT EXISTS idx_equipment_checkouts_active    ON equipment_checkouts(equipment_id) WHERE checked_in_at IS NULL;

-- ── 4. Equipment Templates ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS equipment_templates (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  varchar       NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name        varchar(200)  NOT NULL,
  description text,
  category    varchar(100),
  items       jsonb         NOT NULL DEFAULT '[]',
  created_by  varchar,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_templates_project ON equipment_templates(project_id);
