-- =====================================================================
-- 314_leadgrid_territories.sql
--
-- LeadGrid territorie-håndheving — "hold deg i din grid".
--
-- Gjør territorium om fra fritekst (user_profiles.territory) til en
-- autoritativ grense per selger/promotør. En grid kan defineres som en
-- KOMBINASJON av:
--   - tegnet polygon (GeoJSON, lagret i JSONB), og/eller
--   - administrative enheter (kommunenummer og/eller postnummer).
-- En lead regnes "innenfor" et territorium hvis den matcher polygon
-- ELLER admin-enhet (point-in-polygon gjøres i app-kode — ingen PostGIS).
--
-- Håndheving er MYK: vi blokkerer aldri tilgang. Vi flagger + logger brudd
-- i lead_territory_events og varsler teamleder/salgssjef via
-- notification_events + webhook (territory.breach). Gjelder tre punkter:
--   1) lead-tilgang/handling   (lead_access_out_of_grid)
--   2) fysisk GPS-posisjon      (gps_out_of_grid)
--   3) fysisk besøk/innsjekk    (visit_out_of_grid)
--
-- Nye objekter:
--   - tabell lead_territories
--   - tabell lead_territory_events
--   - crm_customers.municipality_code (kommunenummer; territory_id finnes fra mig 271)
--   - crm_visits.out_of_grid
--   - RBAC: territories.view / territories.manage / territories.view_breaches
--   - webhook-event: territory.breach
--
-- Bygger på:
--   - mig 271 (crm_customers.latitude/longitude/postal_code/territory_id + geo-indeks)
--   - mig 285 (organizations / sales_teams / user_profiles.territory)
--   - mig 286 (permissions / role_permissions)
--   - mig 290 (notification_events)
--   - mig 313 (webhook_event_types + leadgrid_webhook_subscriptions)
--
-- Idempotent: kun nye objekter, IF NOT EXISTS / ON CONFLICT. Rediger
-- ALDRI denne filen etter at den er kjørt — lag en ny migrasjon.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Lead-felter: kommunenummer (postnummer/lat-lng finnes fra mig 271).
--    territory_id (mig 271) brukes som denormalisert cache for matchet grid.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS municipality_code VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_crm_customers_municipality
  ON crm_customers (municipality_code)
  WHERE municipality_code IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Besøk: flagg om et fysisk besøk skjedde utenfor selgerens grid.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE crm_visits
  ADD COLUMN IF NOT EXISTS out_of_grid BOOLEAN NOT NULL DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────
-- 3. lead_territories — autoritativ grid (kombinasjon: polygon + admin)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  -- Eierskap: enten en konkret selger og/eller et team.
  assigned_user_id VARCHAR(255)
    REFERENCES users(id) ON DELETE SET NULL,
  sales_team_id UUID
    REFERENCES sales_teams(id) ON DELETE SET NULL,
  -- Tegnet del: GeoJSON Polygon/MultiPolygon (Feature eller Geometry).
  geometry JSONB,
  -- Administrativ del: kommunenummer og/eller postnummer.
  municipalities TEXT[] NOT NULL DEFAULT '{}',
  postal_codes TEXT[] NOT NULL DEFAULT '{}',
  -- Høyere priority vinner ved overlapp (tie-break i app-kode).
  priority INT NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  created_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- En grid må ha minst én definisjonsform.
  CONSTRAINT lead_territories_has_definition CHECK (
    geometry IS NOT NULL
    OR array_length(municipalities, 1) IS NOT NULL
    OR array_length(postal_codes, 1) IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_lead_territories_org
  ON lead_territories (organization_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_lead_territories_user
  ON lead_territories (assigned_user_id) WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_territories_team
  ON lead_territories (sales_team_id) WHERE sales_team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_territories_municipalities
  ON lead_territories USING GIN (municipalities);
CREATE INDEX IF NOT EXISTS idx_lead_territories_postal_codes
  ON lead_territories USING GIN (postal_codes);

-- FK fra lead → cachet territorium (territory_id er VARCHAR fra mig 271,
-- så vi lager ingen hard FK; app-koden holder den konsistent).

-- ─────────────────────────────────────────────────────────────────────
-- 4. lead_territory_events — logg av myke brudd (mater leder + webhook)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_territory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL
    REFERENCES organizations(id) ON DELETE CASCADE,
  -- Selgeren som var utenfor sin grid.
  user_id VARCHAR(255) NOT NULL
    REFERENCES users(id) ON DELETE CASCADE,
  -- Hvilken grid bruddet gjelder (selgerens egen / den de havnet i).
  territory_id UUID REFERENCES lead_territories(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES crm_customers(id) ON DELETE CASCADE,
  event_kind VARCHAR(40) NOT NULL
    CHECK (event_kind IN (
      'lead_access_out_of_grid',
      'gps_out_of_grid',
      'visit_out_of_grid'
    )),
  -- lat/lng, avstand til nærmeste egen grid, evt. konflikt-selger osv.
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_territory_events_org
  ON lead_territory_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_territory_events_user
  ON lead_territory_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_territory_events_kind
  ON lead_territory_events (event_kind, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 5. Webhook-event for territorie-brudd
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO webhook_event_types (event_key, description) VALUES
  ('territory.breach', 'A seller acted/located outside their assigned territory grid')
ON CONFLICT (event_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────
-- 6. RBAC permissions
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('territories.view',          'Territorier', 'View territory grids'),
  ('territories.manage',        'Territorier', 'Create/edit/delete territory grids and assignments'),
  ('territories.view_breaches', 'Territorier', 'View out-of-grid breach log')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'territories.view'),
  ('admin', 'territories.manage'),
  ('admin', 'territories.view_breaches'),
  ('salgssjef', 'territories.view'),
  ('salgssjef', 'territories.manage'),
  ('salgssjef', 'territories.view_breaches'),
  ('teamleder', 'territories.view'),
  ('teamleder', 'territories.manage'),
  ('teamleder', 'territories.view_breaches'),
  -- Felt-roller kan se egne grids, men ikke forvalte dem.
  ('salgskonsulent', 'territories.view'),
  ('promotor', 'territories.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
