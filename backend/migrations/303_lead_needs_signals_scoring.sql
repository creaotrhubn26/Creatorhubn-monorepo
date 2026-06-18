-- =====================================================================
-- 303_lead_needs_signals_scoring.sql
--
-- 3-deler-taksonomi for hva vi VET om en lead:
--
--   1. needs    — hva bedriften MANGLER. Setter pitch-konteksten.
--                 Eks: needs_video, needs_meta_pixel, needs_seo_structured_data.
--   2. signals  — observasjoner (positive/negative) om dem akkurat nå.
--                 Eks: high_google_rating (+), low_instagram_activity (-).
--   3. scores   — per-dimensjon scoring som blir komponert til ai_opportunity_score.
--
-- Alle tre fylles av lead-scout-service.ts (crawl → Claude). Markedssjef
-- kan endre needs.priority manuelt + override Claude's vurdering.
--
-- Soft FK: customer_id som TEXT (legacy crm_customers.id varierer
-- UUID/VARCHAR per skjema).
-- =====================================================================

BEGIN;

-- ─── needs ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customer_needs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,

  need_type VARCHAR(60) NOT NULL,
  -- Eks: needs_video / needs_meta_pixel / needs_google_ads_pixel /
  -- needs_linkedin_insight / needs_seo_structured_data / needs_ssr_landing /
  -- needs_better_website / needs_reels / needs_case_studies /
  -- needs_review_collection / needs_recruitment_content / needs_launch_campaign /
  -- needs_event_coverage / needs_partner_visibility / needs_food_content /
  -- needs_drone_footage / needs_product_photography / needs_brand_guidelines /
  -- needs_newsletter / needs_press_kit / needs_landing_page / needs_seo_local /
  -- needs_email_campaign / needs_tiktok_presence / needs_linkedin_presence /
  -- needs_podcast_appearance / needs_influencer_collab / needs_lead_magnet

  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  claude_confidence SMALLINT CHECK (claude_confidence BETWEEN 0 AND 100),

  evidence TEXT,                       -- "Ingen GTM-ID i HTML, ingen GA4"
  evidence_url TEXT,                   -- der vi så det

  -- 'detected'   = Claude/scout fant det
  -- 'accepted'   = bruker bekreftet (skal pitches)
  -- 'dismissed'  = bruker forkastet (false positive)
  -- 'resolved'   = løst (kunde har det nå)
  status VARCHAR(20) NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'accepted', 'dismissed', 'resolved')),

  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
                                       -- 'claude' eller user_id
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,

  UNIQUE (customer_id, need_type)
);
CREATE INDEX IF NOT EXISTS idx_crm_needs_customer ON crm_customer_needs(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_needs_type ON crm_customer_needs(need_type, status);
CREATE INDEX IF NOT EXISTS idx_crm_needs_priority ON crm_customer_needs(customer_id, priority DESC) WHERE status IN ('detected', 'accepted');

-- ─── signals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_customer_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,

  signal_type VARCHAR(60) NOT NULL,
  -- Positive: has_google_search_console_verified / has_sitemap_with_lastmod /
  --           high_google_rating / strong_visual_product / high_follower_growth /
  --           active_hiring / recent_funding_round / premium_location /
  --           press_mentions / award_winner / active_on_gmb / clear_value_prop
  -- Negative: missing_all_analytics / missing_all_ads_pixels /
  --           missing_structured_data / spa_rendering_seo_risk /
  --           low_image_optimization / low_instagram_activity /
  --           low_review_count / negative_review_trend / outdated_branding /
  --           mobile_unfriendly_site / slow_page_speed / no_gmb_photos /
  --           competitor_outranks / high_bounce_rate / inactive_social_30d

  polarity VARCHAR(10) NOT NULL CHECK (polarity IN ('positive', 'negative', 'neutral')),
  raw_value TEXT,                      -- "4.8 stjerner (143 anmeldelser)"
  source VARCHAR(40) NOT NULL,         -- google_places / instagram / website /
                                       -- brreg / proff / linkedin / claude / lighthouse
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,              -- når signalet ikke lenger gjelder
                                       -- (f.eks. IG-aktivitet sjekkes på nytt)

  UNIQUE (customer_id, signal_type)
);
CREATE INDEX IF NOT EXISTS idx_crm_signals_customer ON crm_customer_signals(customer_id, polarity);
CREATE INDEX IF NOT EXISTS idx_crm_signals_type ON crm_customer_signals(signal_type);

-- ─── scoring ────────────────────────────────────────────────────
-- Per-dimensjon-snapshot. Beregnet komposisjons-score blir cached i
-- crm_customers.ai_opportunity_score (eksisterende kolonne).
CREATE TABLE IF NOT EXISTS crm_customer_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,

  dimension VARCHAR(40) NOT NULL,
  -- industry / location / google_rating / website_quality / instagram_activity /
  -- missing_video / purchasing_power / past_response / service_match /
  -- years_in_business / employee_count / revenue_growth / seasonality /
  -- area_competition / decision_maker_accessible / brreg_health

  raw_value TEXT,                      -- "5 ansatte (BRREG)" / "3.2 Lighthouse"
  normalized_0_100 SMALLINT NOT NULL CHECK (normalized_0_100 BETWEEN 0 AND 100),
  weight NUMERIC(4,3) NOT NULL DEFAULT 1.0,   -- juster per org via marketing.scoring.weights
  contribution NUMERIC(6,2)             -- = normalized × weight (cached)
    GENERATED ALWAYS AS (normalized_0_100 * weight) STORED,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source VARCHAR(40),                  -- claude / brreg / proff / google / lighthouse

  UNIQUE (customer_id, dimension)
);
CREATE INDEX IF NOT EXISTS idx_crm_scores_customer ON crm_customer_scores(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_scores_dim_contrib ON crm_customer_scores(dimension, contribution DESC);

-- ─── Per-org weight-overstyringer ───────────────────────────────
-- Markedsanalytiker kan justere vektene for hvordan dimensjoner
-- påvirker komposisjons-scoren. Default = 1.0 hvis ingen overstyring.
CREATE TABLE IF NOT EXISTS crm_scoring_weights (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dimension VARCHAR(40) NOT NULL,
  weight NUMERIC(4,3) NOT NULL CHECK (weight >= 0 AND weight <= 5),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (organization_id, dimension)
);

-- ─── Scout-run-historikk ────────────────────────────────────────
-- For å unngå spam-crawling og audit hva som ble crawlet når.
CREATE TABLE IF NOT EXISTS crm_customer_scout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  triggered_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,

  url_crawled TEXT,
  http_status SMALLINT,
  bytes_received INT,
  tech_fingerprint JSONB DEFAULT '{}'::jsonb,
  -- { framework: 'lovable' | 'next' | 'wordpress' | 'squarespace' | 'webflow' | ...,
  --   spa: bool, cms: '...', analytics: ['gtag','plausible',...],
  --   ads: ['meta','google','linkedin','tiktok'], builder: '...' }

  needs_found INT NOT NULL DEFAULT 0,
  signals_found INT NOT NULL DEFAULT 0,
  scores_computed INT NOT NULL DEFAULT 0,

  claude_run_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,

  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_scout_runs_customer ON crm_customer_scout_runs(customer_id, started_at DESC);

COMMIT;
