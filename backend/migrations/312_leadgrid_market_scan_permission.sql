-- =====================================================================
-- 312_leadgrid_market_scan_permission.sql
--
-- Native Leadgrid Market Scan (markedssjef-lead-discovery på iPad).
-- Gjenbruker market_scans-orkestratoren fra migrate 298 + Marketing-
-- rollene fra migrate 302 — vi legger bare til ny RBAC-permission slik
-- at markedssjef + markedskoordinator kan trigge Market Scan direkte
-- fra Leadgrid-hubben (tidligere var det gated bak lead_research.run
-- som er salgs-fokusert).
--
-- Modulen mounter på /api/leadgrid/market-scan/* og bruker samme
-- bakomliggende runResearchOrchestrator() — kun gate-permission skifter.
-- =====================================================================

BEGIN;

-- ─── Ny RBAC-permission for Leadgrid Market Scan ───────────────
INSERT INTO permissions (key, category, description) VALUES
  ('leadgrid.market_scan.run', 'Leadgrid',
   'Starte Market Scan (Claude-discovery + Brønnøysund + Places) som auto-genererer leads på Leadgrid-kartet')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

-- ─── Default-tildeling ─────────────────────────────────────────
-- Markedsroller får Market Scan default (det er deres lead-discovery-
-- verktøy). Salgssjef/teamleder beholder den også fordi det er samme
-- pin-fabrikk som lead_research.run bygger på.
INSERT INTO role_permissions (role, permission_key) VALUES
  ('markedssjef',         'leadgrid.market_scan.run'),
  ('markedskoordinator',  'leadgrid.market_scan.run'),
  ('salgssjef',           'leadgrid.market_scan.run'),
  ('teamleder',           'leadgrid.market_scan.run')
ON CONFLICT (role, permission_key) DO NOTHING;

-- selger + promotor får IKKE default — orgen kan eksplisitt overstyre
-- via user_permission_overrides hvis ønskelig.

COMMIT;
