-- 0388_prospect_segments.sql
-- Vertikal-segmenter (masterkilde-arkitekturen trinn 2): synkroniserte
-- prospekteringslister fra Enhetsregisteret per verifisert NACE-kode —
-- «alle fotografer i Norge» som liste i Leadgrid, uten fullt
-- register-speil.

CREATE TABLE IF NOT EXISTS prospect_segments (
  segment_key   VARCHAR(60) PRIMARY KEY,   -- 'fotografer', 'film-tv', ...
  display_name  TEXT NOT NULL,
  nace_codes    JSONB NOT NULL,            -- ['74.200']
  total_found   INTEGER NOT NULL DEFAULT 0,
  truncated     BOOLEAN NOT NULL DEFAULT FALSE, -- sidetak nådd → ærlig flagg
  refreshed_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS prospect_companies (
  segment_key   VARCHAR(60) NOT NULL REFERENCES prospect_segments(segment_key) ON DELETE CASCADE,
  org_nr        VARCHAR(20) NOT NULL,
  name          TEXT NOT NULL,
  municipality  TEXT,
  employees     INTEGER,
  registered_at DATE,
  website       TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (segment_key, org_nr)
);

CREATE INDEX IF NOT EXISTS idx_prospect_companies_municipality
  ON prospect_companies (segment_key, municipality);
