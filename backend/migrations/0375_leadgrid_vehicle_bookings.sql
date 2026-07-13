-- 0375: leadgrid_vehicle_bookings — Leadgrid Go kjøretøy-booking (2026-07-13).
-- Reserver delte firmabiler i et tidsrom. Org-scopet. Konflikt-sjekk via
-- tstzrange-overlapp i ruta.
CREATE TABLE IF NOT EXISTS leadgrid_vehicle_bookings (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  vehicle_label TEXT NOT NULL,
  vehicle_plate TEXT,
  booked_by TEXT NOT NULL,
  booked_by_name TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lg_vbookings_org ON leadgrid_vehicle_bookings (organization_id, start_at);
