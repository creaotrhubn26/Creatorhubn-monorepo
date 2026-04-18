-- 0048_role_room_feed_strategy_cache.sql
-- Cached social-platform strategy summary used by the feed-planner's AI
-- recommendations. Refreshed in the background (daily) by a Claude call
-- with web_search tool enabled so the summary stays current with algorithm
-- changes published by Meta / TikTok / LinkedIn. Each recommendation
-- request reads from this cache so user-facing latency stays low and
-- deterministic.

CREATE TABLE IF NOT EXISTS role_room_feed_strategy_cache (
  platform TEXT PRIMARY KEY CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
  summary JSONB NOT NULL,
  source_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  status TEXT NOT NULL DEFAULT 'fresh' CHECK (status IN ('fresh', 'stale', 'failed', 'seed')),
  last_error TEXT,
  refreshed_by TEXT
);

COMMENT ON TABLE role_room_feed_strategy_cache IS
  'Per-platform social-strategy summary (algorithm priorities, posting times, caption structure, hashtag guidance, recent changes). Refreshed daily by Claude with web_search; recommendation endpoint reads cache synchronously.';
