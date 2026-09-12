-- 274_brand_kit.sql
--
-- Per-prosjekt Brand Kit. Wrapper rundt eksisterende website_analyses
-- (cached BrandProfile fra role-room-website-analyzer) men gir produsenten
-- mulighet til å overstyre verdier (egne farger, egen tone, egen tagline)
-- uten å miste den auto-detekterte profilen.
--
-- Kobles til casting_projects via project_id. Brand Kit konsumeres av:
--   - Market Intelligence (Fase 2+) — for å avgjøre om konkurrent-stil
--     stemmer eller står ut.
--   - Campaign Builder — for å holde brand-consistency på generert content.
--   - Role Room Agent — for å vite brand-regler ved generering.

BEGIN;

CREATE TABLE IF NOT EXISTS brand_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Eier-prosjekt
  project_id VARCHAR(255) NOT NULL,
  workspace_owner_user_id VARCHAR(255) NOT NULL,

  -- Source-URL som ble scannet for å bygge auto-profil
  source_url TEXT NOT NULL,

  -- Auto-detektert BrandProfile (samme JSONB-shape som
  -- website_analyses.brand_profile). Frosset ved scan-tidspunkt.
  brand_profile JSONB NOT NULL,

  -- Brukerens overrides (samme shape som BrandProfile, men kun de felt
  -- brukeren har endret). Når BrandKit konsumeres, merges overrides
  -- over brand_profile.
  overrides JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Confidence pr. felt: 'auto' (fra scan) | 'user' (brukeroverride) | 'missing'
  field_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Sist re-scannet (NULL = aldri re-scannet etter initial)
  last_scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ett brand kit per prosjekt
  UNIQUE (project_id)
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_project_id ON brand_kits (project_id);
CREATE INDEX IF NOT EXISTS idx_brand_kits_workspace_owner ON brand_kits (workspace_owner_user_id);

-- Helper trigger: oppdater updated_at automatisk
CREATE OR REPLACE FUNCTION brand_kits_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brand_kits_updated_at ON brand_kits;
CREATE TRIGGER brand_kits_updated_at
  BEFORE UPDATE ON brand_kits
  FOR EACH ROW
  EXECUTE FUNCTION brand_kits_set_updated_at();

COMMIT;
