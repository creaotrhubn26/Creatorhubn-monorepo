-- 0091_role_room_kpi_snapshots.sql
-- KPI-tracking for marketing-plan-posts (item #176 + #180).
--
-- Hver row er ett målepunkt for én post på én plattform med én metric.
-- Vi snapshotter daglig (eller når connectoren henter ferskt data) slik
-- at vi kan tegne "Target vs Actual"-grafer over tid og beregne
-- z-score-outliers per pillar (#189).
--
-- Designvalg:
--   - Bruker TEXT for metric-navn (impressions/reach/likes/etc.) i stedet
--     for enum — Meta/TikTok/LinkedIn har forskjellige metric-navn og vi
--     vil ikke trenge migrasjon hver gang en plattform legger til en ny.
--   - source-feltet sier hvilken connector ga oss verdien (meta_graph,
--     tiktok_business, linkedin_pages, manual) for debugging og
--     å kunne re-fetche kun fra én provider.
--   - (post_id, platform, metric, captured_at) er UNIQUE — én row per
--     daglig snapshot. ON CONFLICT DO UPDATE ved gjentakelse samme dag.

CREATE TABLE IF NOT EXISTS role_room_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lenke til marketing-plan-post. Når posten slettes, ryddes snapshots også.
  post_id UUID NOT NULL REFERENCES role_room_marketing_plan_posts(id) ON DELETE CASCADE,
  -- Plan_id duplicates for å unngå JOIN i hver aggregeringsquery.
  plan_id UUID NOT NULL REFERENCES role_room_marketing_plans(id) ON DELETE CASCADE,
  -- Plattform-streng: 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'manual'
  platform TEXT NOT NULL,
  -- Metric-navn: 'impressions' | 'reach' | 'likes' | 'comments' | 'shares' |
  --              'saves' | 'video_views' | 'engagement' | 'profile_visits' | ...
  metric TEXT NOT NULL,
  -- Verdien som en double precision — håndterer både tall (impressions=1234)
  -- og ratioer (engagement_rate=0.045) i samme kolonne.
  value DOUBLE PRECISION NOT NULL,
  -- ISO date when datapoint ble samlet — typisk midnatt UTC for daglige snapshots.
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Hvor data kom fra: 'meta_graph' | 'tiktok_business' | 'linkedin_pages' | 'manual'
  source TEXT NOT NULL DEFAULT 'manual',
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Dag-grain unik constraint slik at gjenta-snapshots overskriver
  UNIQUE (post_id, platform, metric, captured_at)
);

CREATE INDEX IF NOT EXISTS role_room_kpi_snapshots_plan_idx
  ON role_room_kpi_snapshots (plan_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS role_room_kpi_snapshots_post_idx
  ON role_room_kpi_snapshots (post_id, metric, captured_at DESC);
CREATE INDEX IF NOT EXISTS role_room_kpi_snapshots_platform_metric_idx
  ON role_room_kpi_snapshots (platform, metric, captured_at DESC);

COMMENT ON TABLE role_room_kpi_snapshots IS
  'Tidsserier av KPI-data per marketing-plan-post. Daglige snapshots fra plattformenes Insights-APIer.';
COMMENT ON COLUMN role_room_kpi_snapshots.source IS
  'Hvilken connector skrev raden — brukes for re-fetch og debugging.';
