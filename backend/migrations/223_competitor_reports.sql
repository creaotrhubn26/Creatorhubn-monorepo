-- 223_competitor_reports.sql
--
-- Storage for AI-genererte konkurrent-rapporter. En rapport per (brandKey,
-- generatedAt) lagrer Claudes output + en hash av input-state for cache-
-- detection. Brukes av Marketing Cockpit til å vise "siste rapport" + en
-- enkel historikk-liste.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS marketing_competitor_reports (
  id                  BIGSERIAL PRIMARY KEY,
  brand_key           TEXT NOT NULL,
  generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  input_hash          TEXT NOT NULL,           -- SHA-1 of input snapshot-state (for cache lookup)
  competitor_count    INTEGER NOT NULL,
  report_json         JSONB NOT NULL,
  generated_with_model TEXT,
  cost_nok            NUMERIC(8, 4),
  triggered_by        TEXT                     -- 'manual', 'auto-weekly', etc.
);

CREATE INDEX IF NOT EXISTS idx_marketing_competitor_reports_brand_time
  ON marketing_competitor_reports (brand_key, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_competitor_reports_cache
  ON marketing_competitor_reports (brand_key, input_hash, generated_at DESC);
