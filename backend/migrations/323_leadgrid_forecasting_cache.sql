-- =====================================================================
-- 323_leadgrid_forecasting_cache.sql
--
-- Skalering nivå 3b — Pipeline forecasting + NBA attribution-modell.
--
-- Lager to cache-tabeller som ligger over eksisterende
-- lead_scores_history + lead_recommendations + crm_customers:
--
--   leadgrid_forecast_cache       — predikerte revenue-bånd (p10/p50/p90)
--                                   per (org, horizon_days). Refresh hver
--                                   6. time via service-laget.
--
--   leadgrid_attribution_aggregates — pr. action_type: win-rate, dager til
--                                     vunnet, snitt deal-verdi. Brukes til å
--                                     identifisere hvilke NBA-taktikker som
--                                     korrelerer med won.
--
-- Permission: forecasting.view (admin, salgssjef, teamleder).
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Cache for forecasting-beregninger (refresh hvert 6 time)
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_forecast_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  horizon_days INTEGER NOT NULL,            -- typisk 30, 90, 180
  -- Predikerte verdier
  predicted_revenue_low NUMERIC(12,2),      -- p10
  predicted_revenue_mid NUMERIC(12,2),      -- p50 (median)
  predicted_revenue_high NUMERIC(12,2),     -- p90
  predicted_won_deals INTEGER,
  predicted_avg_cycle_days NUMERIC(6,2),
  -- Konfidens og forklaring
  confidence_score NUMERIC(3,2),            -- 0.0-1.0
  reasoning TEXT,                            -- Claude-generated 2-3 setninger
  contributing_factors JSONB,               -- [{factor, weight, direction}]
  -- Metadata
  active_pipeline_value NUMERIC(12,2),      -- nåværende pipeline expected_value
  active_deals INTEGER,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  computed_via VARCHAR(20) DEFAULT 'claude',
  UNIQUE (organization_id, horizon_days)
);
CREATE INDEX IF NOT EXISTS idx_forecast_cache_org_age
  ON leadgrid_forecast_cache(organization_id, computed_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 2. Attribution-aggregat per action_type
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leadgrid_attribution_aggregates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  action_type VARCHAR(60) NOT NULL,
  window_days INTEGER NOT NULL,
  total_executed INTEGER DEFAULT 0,
  total_won INTEGER DEFAULT 0,
  total_lost INTEGER DEFAULT 0,
  win_rate NUMERIC(5,4),
  avg_days_to_won NUMERIC(6,2),
  avg_deal_value NUMERIC(12,2),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, action_type, window_days)
);
CREATE INDEX IF NOT EXISTS idx_attribution_aggregates_org
  ON leadgrid_attribution_aggregates(organization_id, window_days, computed_at DESC);

-- ─────────────────────────────────────────────────────────────────────
-- 3. RBAC
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('forecasting.view', 'Prognoser', 'Se pipeline-forecast og NBA-attribution')
ON CONFLICT (key) DO UPDATE
  SET category    = EXCLUDED.category,
      description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin',     'forecasting.view'),
  ('salgssjef', 'forecasting.view'),
  ('teamleder', 'forecasting.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
