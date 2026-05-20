-- Slice 9X.71 — AI cost tracking
--
-- Per kall til Anthropic Claude API: hvilken modell, hvor mange tokens
-- (input/output + cache), beregnet kostnad i USD, hvilken feature som
-- utløste kallet, hvilken bruker. Aggregeres i admin AI-cost-dashboard.

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model           VARCHAR(64) NOT NULL,
  feature         VARCHAR(64) NOT NULL,
  route           VARCHAR(128),
  user_id         VARCHAR(64),
  input_tokens    INTEGER NOT NULL DEFAULT 0,
  output_tokens   INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens  INTEGER DEFAULT 0,
  cache_write_tokens INTEGER DEFAULT 0,
  cost_usd        NUMERIC(10, 6) NOT NULL DEFAULT 0,
  duration_ms     INTEGER,
  success         BOOLEAN NOT NULL DEFAULT TRUE,
  error_code      VARCHAR(64),
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature    ON ai_usage_log (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user       ON ai_usage_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_model      ON ai_usage_log (model, created_at DESC);
