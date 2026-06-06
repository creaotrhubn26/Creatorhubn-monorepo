-- 220_agent_profile_recommendations.sql
--
-- Storage for Role Room Agent's generated profile-recommendations
-- (per-platform bio/cover/CTA-anbefalinger) + publish-log som
-- viser hvilke versjoner som ble pushet til Meta-API når.
--
-- Idempotent: kjør flere ganger trygt.

CREATE TABLE IF NOT EXISTS agent_profile_recommendations (
  id                     BIGSERIAL PRIMARY KEY,
  brand_key              TEXT NOT NULL,          -- "theroleroom", "creatorhub-norge", etc.
  bootstrap_hash         TEXT NOT NULL,          -- SHA-1 of input bootstrap (cache key)
  recommendations_json   JSONB NOT NULL,         -- Full ProfileRecommendations object
  generated_with_model   TEXT,
  cost_nok               NUMERIC(8, 4),          -- Compute-cost for this generation
  generated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_profile_recs_brand_generated
  ON agent_profile_recommendations (brand_key, generated_at DESC);

-- Cache-lookup: most recent recommendation for a given (brand, hash)
CREATE INDEX IF NOT EXISTS idx_agent_profile_recs_cache
  ON agent_profile_recommendations (brand_key, bootstrap_hash, generated_at DESC);

CREATE TABLE IF NOT EXISTS agent_profile_publish_log (
  id                     BIGSERIAL PRIMARY KEY,
  brand_key              TEXT NOT NULL,
  platform               TEXT NOT NULL,          -- "facebook" | "instagram" | "linkedin" | "tiktok"
  field                  TEXT NOT NULL,          -- "bio" | "about" | "website" | "phone" | "cta" | "cover"
  value                  TEXT NOT NULL,
  status                 TEXT NOT NULL,          -- "success" | "failed" | "manual_copy"
  api_response           JSONB,                  -- Raw Meta API response
  error_message          TEXT,
  recommendation_id      BIGINT REFERENCES agent_profile_recommendations(id) ON DELETE SET NULL,
  published_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_by_user_id   BIGINT                  -- admin user who triggered the publish
);

CREATE INDEX IF NOT EXISTS idx_agent_profile_publish_log_brand
  ON agent_profile_publish_log (brand_key, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_profile_publish_log_platform
  ON agent_profile_publish_log (brand_key, platform, published_at DESC);
