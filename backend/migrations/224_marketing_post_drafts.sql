-- 224_marketing_post_drafts.sql
--
-- Storage for AI-genererte post-utkast (Claude-skrevet basert på rapport-insights).
-- Flyten: rapport-insight → "Skriv dette innlegget"-knapp → Claude komponerer →
-- lagres som draft → admin redigerer → publisher.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS marketing_post_drafts (
  id                BIGSERIAL PRIMARY KEY,
  brand_key         TEXT NOT NULL,
  platform          TEXT NOT NULL,         -- 'facebook' | 'instagram' | 'linkedin' | 'tiktok'
  status            TEXT NOT NULL DEFAULT 'draft', -- draft | edited | published | failed
  source_insight    TEXT,                  -- Hvilken insight-tittel ga grunnlaget
  source_action     TEXT,                  -- Hvilken actionableStep konkret
  source_report_id  BIGINT REFERENCES marketing_competitor_reports(id) ON DELETE SET NULL,
  caption           TEXT NOT NULL,         -- Ferdig post-copy
  hashtags          JSONB,                 -- Array of strings
  image_brief       TEXT,                  -- Beskrivelse av bilde
  cta_text          TEXT,                  -- "Les mer", "Book demo" etc.
  cta_link          TEXT,
  suggested_publish_time TIMESTAMPTZ,      -- Forslag fra Claude
  generated_with_model TEXT,
  cost_nok          NUMERIC(8, 4),
  generated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ,
  external_post_id  TEXT,                  -- Meta/LinkedIn post-ID etter publish
  publish_error     TEXT,
  raw_publish_response JSONB
);

CREATE INDEX IF NOT EXISTS idx_marketing_post_drafts_brand_status
  ON marketing_post_drafts (brand_key, status, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_post_drafts_report
  ON marketing_post_drafts (source_report_id);
