-- Migration 132: Cache for AI-generated carousel images.
-- Avoids paying Replicate twice for identical prompts within 30 days.

CREATE TABLE IF NOT EXISTS carousel_ai_image_cache (
  cache_key VARCHAR(64) PRIMARY KEY,
  generated_url TEXT NOT NULL,
  model VARCHAR(80) NOT NULL,
  cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carousel_ai_image_cache_age
  ON carousel_ai_image_cache(generated_at);
