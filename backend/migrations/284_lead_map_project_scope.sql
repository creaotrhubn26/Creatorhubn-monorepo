-- 284_lead_map_project_scope.sql
--
-- Kobler Lead Map (crm_customers + market_scan_competitors) til
-- prosjekt-konseptet via casting_projects.
--
-- Bakgrunn:
--   brand_kits.project_id og market_scans.project_id finnes allerede
--   (mig 274/275). crm_customers manglet kobling.
--
-- Visjon (Daniels brief):
--   En bruker kan jobbe på flere prosjekter samtidig (Holy Crust,
--   MedInnova, etc.). Hvert prosjekt har:
--     - en analysert bedrift (brand_kit)
--     - markedsanalyse (market_scan + competitors)
--     - egne leads (potensielle kunder for denne bedriften)
--     - egne reminders/calendar/leaderboard
--
--   Lead Map filtreres pr aktivt prosjekt. UI viser et "prosjekt-kort"
--   øverst med bedriftens posisjonering + målsetting.
--
-- Backward-compat:
--   project_id er NULLABLE — eksisterende leads uten prosjekt vises
--   under "Uten prosjekt". Migrasjonen seeder ikke (krever brukerens
--   tildeling i UI).

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255)
    REFERENCES casting_projects(id) ON DELETE SET NULL;

ALTER TABLE market_scan_competitors
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255)
    REFERENCES casting_projects(id) ON DELETE SET NULL;

-- Indekser for å filtrere effektivt pr prosjekt
CREATE INDEX IF NOT EXISTS idx_leads_project
  ON crm_customers (project_id, owner_user_id, lead_status)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_competitors_project
  ON market_scan_competitors (project_id, threat_level)
  WHERE project_id IS NOT NULL;

-- Backfill: market_scan_competitors arver project_id fra parent scan
-- når den finnes (auto-discovered konkurrenter er allerede koblet via
-- market_scan_id → market_scans.project_id).
UPDATE market_scan_competitors c
   SET project_id = s.project_id
  FROM market_scans s
 WHERE c.market_scan_id = s.id
   AND c.project_id IS NULL
   AND s.project_id IS NOT NULL;

COMMIT;
