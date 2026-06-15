-- 281_competitor_geo.sql
--
-- Lead Map ↔ Konkurrent-integrasjon.
--
-- Role Room Agent's Market Scan finner konkurrenter via Claude.
-- Vi utvider market_scan_competitors med Google Places-data slik at
-- konkurrenter kan vises som pins på Lead Map sammen med leads.
--
-- Bakgrunn:
--   * Role Room Agent har allerede Google Places-tilgang (via
--     lead-map-places-routes.ts) — vi gjenbruker samme klient
--   * Konkurrent-discovery skjer i runMarketScan → fetch + Places-lookup
--     per domain populerer disse feltene
--   * Frontend bruker (latitude, longitude) til å plotte
--     diamant-pins distinkt fra droppin lead-pins
--
-- Ingen reverse migration — kun additive ALTERs.

BEGIN;

-- Tillat freestanding konkurrenter (manuelt lagt til uten Market Scan-kobling)
ALTER TABLE market_scan_competitors
  ALTER COLUMN market_scan_id DROP NOT NULL;

-- Workspace-eier må alltid være satt så vi får tenant-isolasjon for
-- manuelle konkurrenter (auto-discovered arver via market_scans.workspace_owner)
ALTER TABLE market_scan_competitors
  ADD COLUMN IF NOT EXISTS workspace_owner_user_id VARCHAR(255);

-- Backfill workspace_owner fra parent market_scan
UPDATE market_scan_competitors c
   SET workspace_owner_user_id = s.workspace_owner_user_id
  FROM market_scans s
 WHERE c.market_scan_id = s.id
   AND c.workspace_owner_user_id IS NULL;

ALTER TABLE market_scan_competitors
  -- Google Places-felter
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(200),
  ADD COLUMN IF NOT EXISTS google_address TEXT,
  ADD COLUMN IF NOT EXISTS google_phone VARCHAR(80),
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS google_user_ratings_total INTEGER,
  ADD COLUMN IF NOT EXISTS google_lookup_at TIMESTAMPTZ,

  -- Manuell add vs auto-discovered av Claude
  ADD COLUMN IF NOT EXISTS is_manual_addition BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS added_by_user_id VARCHAR(255),

  -- Trussel-vurdering (Claude eller manuelt satt):
  --   'near'   = direkte konkurrent — overlapper kunde-base + offering
  --   'medium' = indirekte — overlapper geografi men annet tilbud
  --   'far'    = randzonen — lite bekymring
  ADD COLUMN IF NOT EXISTS threat_level VARCHAR(10)
    CHECK (threat_level IN ('near','medium','far')),
  ADD COLUMN IF NOT EXISTS threat_score INTEGER
    CHECK (threat_score IS NULL OR (threat_score >= 0 AND threat_score <= 100)),

  -- Claude-genererte tekster (oppdateres ved hver analyse-pass)
  ADD COLUMN IF NOT EXISTS claude_threat_summary TEXT,
  ADD COLUMN IF NOT EXISTS claude_what_to_worry_about TEXT,
  ADD COLUMN IF NOT EXISTS claude_what_to_ignore TEXT,
  ADD COLUMN IF NOT EXISTS claude_assessed_at TIMESTAMPTZ,

  -- Eksplisitt rangering — brukeren kan låse en konkurrent øverst
  ADD COLUMN IF NOT EXISTS priority_rank INTEGER;

-- Spatial-ish index for bbox-spørringer fra Lead Map
CREATE INDEX IF NOT EXISTS idx_competitors_geo
  ON market_scan_competitors (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Lookup på place_id ved re-discovery (samme konkurrent på tvers av scans)
CREATE INDEX IF NOT EXISTS idx_competitors_place_id
  ON market_scan_competitors (google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Trussel-sortering per scan
CREATE INDEX IF NOT EXISTS idx_competitors_threat
  ON market_scan_competitors (market_scan_id, threat_level, threat_score DESC NULLS LAST)
  WHERE threat_level IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- Lead-rangering: utvide crm_customers med Claude's "anbefalt-prioritet"
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE crm_customers
  -- Bedre enn aiOpportunityScore alene — også begrunnelse + når sist vurdert
  ADD COLUMN IF NOT EXISTS claude_recommendation_rank INTEGER
    CHECK (claude_recommendation_rank IS NULL
           OR (claude_recommendation_rank >= 0 AND claude_recommendation_rank <= 100)),
  ADD COLUMN IF NOT EXISTS claude_recommendation_reason TEXT,
  ADD COLUMN IF NOT EXISTS claude_ranked_at TIMESTAMPTZ;

-- Sort på "mest anbefalt først" i Lead Map listevisning
CREATE INDEX IF NOT EXISTS idx_leads_recommendation_rank
  ON crm_customers (owner_user_id, claude_recommendation_rank DESC NULLS LAST)
  WHERE claude_recommendation_rank IS NOT NULL;

COMMIT;
