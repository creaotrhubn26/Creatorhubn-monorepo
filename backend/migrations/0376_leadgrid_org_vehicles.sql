-- 0376: leadgrid_org_vehicles — Leadgrid Go flåteregister (2026-07-16).
-- Org-EIDE firmabiler registrert sentralt av admin/salgssjef, i motsetning til
-- leadgrid_vehicles (0373) som er sjåførens selvregistrerte «Min bil»
-- (user_id PK, forsvinner med brukeren). Flåtebiler kan være delte (bookbare
-- via leadgrid_vehicle_bookings) eller fast tildelt en sjåfør.
CREATE TABLE IF NOT EXISTS leadgrid_org_vehicles (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  plate TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  fuel TEXT NOT NULL DEFAULT 'unknown',
  kind TEXT NOT NULL DEFAULT 'car',
  eu_control_due DATE,
  is_shared BOOLEAN NOT NULL DEFAULT true,
  assigned_user_id TEXT,
  assigned_user_name TEXT,
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ett aktivt innslag per skilt per org (avregistrerte kan gjenbruke skiltet).
CREATE UNIQUE INDEX IF NOT EXISTS uq_lg_orgveh_org_plate_active
  ON leadgrid_org_vehicles (organization_id, plate) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_lg_orgveh_org_status
  ON leadgrid_org_vehicles (organization_id, status);
