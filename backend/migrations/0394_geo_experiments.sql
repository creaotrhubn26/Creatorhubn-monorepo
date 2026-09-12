-- 0394_geo_experiments.sql
-- GEO-eksperimentloggen: hva endret vi når (innhold/llms.txt/struktur),
-- så neste målings SOV-endring kan KOBLES til årsak — dokumentert
-- årsak-virkning for AI-synlighet.

CREATE TABLE IF NOT EXISTS geo_experiments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  experiment_date DATE NOT NULL,
  description     TEXT NOT NULL,
  topic           TEXT,          -- tema/sett endringen sikter mot (valgfritt)
  url             TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geo_experiments_org
  ON geo_experiments (organization_id, experiment_date DESC);
