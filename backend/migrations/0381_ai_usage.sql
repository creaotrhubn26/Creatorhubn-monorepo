-- 0381_ai_usage.sql
-- Per-org AI-forbrukstellere (integrasjonsanalysen steg 9).
--
-- Motivasjon: kreditt-hendelsen 2026-07-12 (Anthropic-org gikk tom og tok
-- ned ALL prod-AI). Tellerne gir synlighet i hvem/hva som bruker tokens,
-- per dag, leverandør og operasjon — grunnlag for varsler og budsjetter.
--
-- Én rad per (org, dag, leverandør, operasjon); skrives med UPSERT-inkrement.

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  day             DATE NOT NULL,
  provider        VARCHAR(40) NOT NULL,   -- 'anthropic' | 'openai' | 'perplexity' | ...
  operation       VARCHAR(60) NOT NULL,   -- 'geo-probe' | 'geo-brand-extraction' | ...
  calls           INTEGER NOT NULL DEFAULT 0,
  input_tokens    BIGINT  NOT NULL DEFAULT 0,
  output_tokens   BIGINT  NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, day, provider, operation)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_org_day
  ON ai_usage_daily (organization_id, day DESC);
