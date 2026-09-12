-- =====================================================================
-- 262_tiktok_measurement_crm.sql
--
-- Phase 2 av TikTok Marketing API utvidet integrasjon:
--   - Measurement: cache attribution-rapporter (28d post-click + view-through)
--   - CRM Event Management: logg server-side events som sendes til TikTok
--     (TRIAL_START, PAID_SIGNUP, LEAD_QUALIFIED, etc) for ad-optimalisering
-- =====================================================================

BEGIN;

-- Attribution-rapporter — cached for å unngå rate-limiting + raskere UI
CREATE TABLE IF NOT EXISTS tiktok_attribution_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  -- NULL config_id = The Role Rooms egen Marketing Cockpit
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,

  -- Aggregerte metrikker
  click_conversions INTEGER DEFAULT 0,
  view_through_conversions INTEGER DEFAULT 0,
  total_attributed_revenue NUMERIC(14,2) DEFAULT 0,
  total_ad_spend NUMERIC(14,2) DEFAULT 0,
  roas NUMERIC(8,3),

  -- Per-event breakdown (JSONB for fleksibilitet)
  event_breakdown JSONB DEFAULT '{}'::jsonb,
  -- {"COMPLETE_PAYMENT": {"clicks": 12, "views": 3, "revenue": 24000},
  --  "SUBMIT_FORM": {...}}

  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '6 hours',
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_attribution_config
  ON tiktok_attribution_snapshots(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_attribution_advertiser_range
  ON tiktok_attribution_snapshots(advertiser_id, date_range_start DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_attribution_fresh
  ON tiktok_attribution_snapshots(expires_at)
  WHERE expires_at > NOW();

-- CRM-events sendt til TikTok (server-side conversion-sync)
CREATE TABLE IF NOT EXISTS tiktok_crm_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES client_ads_configs(id) ON DELETE CASCADE,
  producer_user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  advertiser_id TEXT NOT NULL,

  -- Event-data
  event_name TEXT NOT NULL,            -- 'TRIAL_START', 'PAID_SIGNUP', 'LEAD_QUALIFIED'
  event_time TIMESTAMPTZ NOT NULL,
  event_source TEXT,                   -- 'crm_admin_room', 'stripe_webhook', 'manual'
  external_user_id TEXT,               -- hashed email/phone for deduplisering
  event_value NUMERIC(10,2),
  event_currency TEXT DEFAULT 'NOK',
  custom_properties JSONB DEFAULT '{}'::jsonb,

  -- Sync-status
  delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN (
    'pending', 'delivered', 'failed', 'retrying'
  )),
  delivered_at TIMESTAMPTZ,
  tiktok_response JSONB,
  attempt_count INTEGER DEFAULT 0,
  last_error TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tiktok_crm_event_config
  ON tiktok_crm_event_log(config_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_crm_event_pending
  ON tiktok_crm_event_log(delivery_status, created_at)
  WHERE delivery_status IN ('pending', 'retrying');
CREATE INDEX IF NOT EXISTS idx_tiktok_crm_event_name_date
  ON tiktok_crm_event_log(event_name, event_time DESC);

COMMIT;
