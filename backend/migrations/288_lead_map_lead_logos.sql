-- 288_lead_map_lead_logos.sql
--
-- Logo-URL på leads (bedrifter) — vises som pin på Lead Map.
-- Daniel kan laste opp eller lime inn URL; Claude/BRREG kan også
-- auto-fylle hvis bedriften har offentlig logo.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Hvis market_scan_competitors brukes som backup-source:
ALTER TABLE market_scan_competitors
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMIT;
