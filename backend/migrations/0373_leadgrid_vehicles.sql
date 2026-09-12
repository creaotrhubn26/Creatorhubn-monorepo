-- 0373: leadgrid_vehicles — Leadgrid Go «Min bil»-profil server-side (2026-07-13)
--
-- Sjåførens registrerte kjøretøy (drivstoff/type/firmabil), synket fra iPad.
-- Så admin-dashbordet ser hvilken (firma-)bil hver sjåfør bruker — også før
-- de har kjørt (team-endepunktet leste tidligere kun trips.vehicle_name).
--
-- Én rad per bruker (user_id PK). Ingen eier-PII — kun tekniske felt.

CREATE TABLE IF NOT EXISTS leadgrid_vehicles (
  user_id        TEXT PRIMARY KEY,
  plate          TEXT,
  display_name   TEXT,
  fuel           TEXT NOT NULL DEFAULT 'unknown',
  kind           TEXT NOT NULL DEFAULT 'car',
  is_company_car BOOLEAN NOT NULL DEFAULT false,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
