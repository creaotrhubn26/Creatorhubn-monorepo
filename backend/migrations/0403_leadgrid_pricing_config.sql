-- =====================================================================
-- mig 0403 — Leadgrid offentlig pris-config (én sannhetskilde)
--
-- Singleton-tabell som holder tiers + tilleggsmoduler + bundle som JSONB.
-- Super-admin skriver (iPad + web-admin), leadgrid.no leser offentlig →
-- pris/modul-endringer flyter til nettsiden uten deploy.
--
-- Tidligere var tiers og moduler HARDKODET i frontend (leadgrid-landing).
-- Denne configen erstatter den hardkodingen som datakilde.
--
-- Singleton: id = 1 (CHECK) så det aldri finnes mer enn én config-rad.
-- Idempotent — IF NOT EXISTS.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_pricing_config (
  id          INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config      JSONB NOT NULL,
  updated_by  VARCHAR(255),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
