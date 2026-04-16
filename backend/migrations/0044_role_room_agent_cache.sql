-- 0044_role_room_agent_cache.sql
-- Cost-efficiency cache for The Role Room Agent (Claude).
--
-- Every agent call gets keyed by SHA-256(project_id + context_hash +
-- user_message). If the same query comes in within the TTL, serve the
-- cached response and skip the Anthropic call entirely.
--
-- Retention: 30 minutes default TTL per row. A cron prunes expired rows
-- and anything older than 7 days regardless of TTL so the table stays small.

CREATE TABLE IF NOT EXISTS role_room_agent_response_cache (
  -- SHA-256 hex of the keying tuple. Primary key — collisions not a
  -- concern for our scale but hex string is comparison-friendly.
  cache_key TEXT PRIMARY KEY,

  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  model TEXT NOT NULL,
  -- Full normalized response JSON (text + toolUses + transparency + usage).
  response JSONB NOT NULL,

  -- Token usage for the CACHED response — so when we serve from cache we
  -- can surface the saved tokens in analytics.
  cached_prompt_tokens INTEGER,
  cached_completion_tokens INTEGER,

  -- Counters so we know how valuable a cache entry is.
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS role_room_agent_response_cache_project_idx
  ON role_room_agent_response_cache (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_agent_response_cache_expires_idx
  ON role_room_agent_response_cache (expires_at);

COMMENT ON TABLE role_room_agent_response_cache IS
  'Cost-saving dedup for Role Room Agent calls. TTL default 30 min; hard max 7 days. Pruned nightly.';
