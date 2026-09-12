-- =====================================================================
-- 321_leadgrid_ai_usage.sql
--
-- Per-org AI-cost tracking for Leadgrid. Logger hvert AI-kall
-- (Claude, OpenAI Whisper, OpenAI Chat) m/ tokens, audio-sekunder
-- og estimert USD-kost. Daglig aggregat for rask quota-sjekk og
-- billing-dashboard.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  provider VARCHAR(40) NOT NULL,  -- 'claude', 'openai_whisper', 'openai_chat'
  model VARCHAR(80),               -- 'claude-opus-4-7', 'claude-sonnet-4-6', 'whisper-1'
  operation VARCHAR(60) NOT NULL,  -- 'meeting_notes_analyze', 'research', 'market_scan', ...
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  audio_seconds NUMERIC(10,2),     -- for Whisper
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  lead_id UUID,                    -- valgfri kobling
  user_id VARCHAR(255),
  request_id UUID,                 -- for korrelasjon med Sentry
  succeeded BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_ai_usage_org_date
  ON leadgrid_ai_usage(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leadgrid_ai_usage_provider
  ON leadgrid_ai_usage(provider, created_at DESC);

-- Daglig aggregat for rask quota-sjekk
CREATE TABLE IF NOT EXISTS leadgrid_ai_usage_daily (
  organization_id UUID NOT NULL,
  usage_date DATE NOT NULL,
  provider VARCHAR(40) NOT NULL,
  total_calls INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_audio_seconds NUMERIC(10,2) DEFAULT 0,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  PRIMARY KEY (organization_id, usage_date, provider)
);

INSERT INTO permissions (key, category, description) VALUES
  ('billing.view_ai_usage', 'Fakturering', 'Se org-ens AI-bruk og kost')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'billing.view_ai_usage'),
  ('salgssjef', 'billing.view_ai_usage')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
