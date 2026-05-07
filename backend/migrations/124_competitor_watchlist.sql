-- 124_competitor_watchlist.sql
-- Page Metadata 2.0 Fase 1 — Foundation
--
-- Watchlist + daglig snapshot-historikk for konkurrent-/inspirasjons-brands.
-- Erstatter ad-hoc meta-page-inspector med vedvarende observasjon.
-- Multi-platform: facebook, instagram, tiktok, linkedin, youtube.

BEGIN;

CREATE TABLE IF NOT EXISTS competitor_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR NOT NULL,
  user_id VARCHAR NOT NULL,
  brand_name VARCHAR(200) NOT NULL,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook','instagram','tiktok','linkedin','youtube')),
  -- Plattform-spesifikk identifikator: page_id (FB), ig_business_user_id (IG),
  -- @username (TT), urn:li:organization:... (LI), channel_id (YT).
  external_id VARCHAR(255) NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_fetched_at TIMESTAMPTZ,
  -- Cached siste snapshot for rask UI-rendering uten join.
  metadata JSONB,
  UNIQUE (project_id, platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_project
  ON competitor_watchlist(project_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_user
  ON competitor_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_last_fetched
  ON competitor_watchlist(last_fetched_at NULLS FIRST);

COMMENT ON TABLE competitor_watchlist IS
  'Konkurrent/inspirasjons-brands brukeren overvåker. Daglig cron snapshotter metadata til competitor_metadata_snapshots.';

CREATE TABLE IF NOT EXISTS competitor_metadata_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES competitor_watchlist(id) ON DELETE CASCADE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Kjerne-metrics aggregert fra plattform-API
  followers_count BIGINT,
  posts_30d INTEGER,
  engagement_avg_30d NUMERIC(10, 4),
  about_text TEXT,
  category VARCHAR(120),
  -- Full plattform-respons for fremtidig backfill (token-cost-effektivt
  -- å spare alt heller enn å re-fetche ved analytics-endringer)
  raw_metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_snapshots_watchlist_date
  ON competitor_metadata_snapshots(watchlist_id, fetched_at DESC);

COMMENT ON TABLE competitor_metadata_snapshots IS
  'Daglige snapshots per watchlist-rad. Brukes til trend-grafer (sparkline) og diff-deteksjon (Fase 2 alerts).';

COMMIT;
