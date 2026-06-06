-- 225_brand_metrics_snapshots.sql
--
-- Storage for The Role Rooms egne metric-snapshots på tvers av plattformer.
-- Brukes som "self-state" input til AI-rapporten så Claude kan sette
-- realistiske KPI-mål basert på gap vs konkurrenter.
--
-- En rad = ett snapshot for én plattform på ett tidspunkt. Hver plattform
-- har sin egen JSONB-payload med plattform-spesifikke felter.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS brand_metrics_snapshots (
  id              BIGSERIAL PRIMARY KEY,
  brand_key       TEXT NOT NULL,                    -- 'theroleroom'
  platform        TEXT NOT NULL,                    -- 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'ga4'
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics_json    JSONB NOT NULL,                   -- Plattform-specifik shape
  source          TEXT NOT NULL DEFAULT 'manual',   -- 'manual' | 'auto-worker' | 'cron'
  fetch_error     TEXT
);

CREATE INDEX IF NOT EXISTS idx_brand_metrics_snapshots_brand_platform_time
  ON brand_metrics_snapshots (brand_key, platform, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_metrics_snapshots_latest
  ON brand_metrics_snapshots (brand_key, platform, snapshot_at DESC)
  WHERE fetch_error IS NULL;
