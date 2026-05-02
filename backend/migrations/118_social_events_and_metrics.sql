-- Foundation for cross-platform social listening + analytics.
--
-- Unified storage for inbound events (comments, mentions, DMs, reactions)
-- and performance metrics (impressions, reach, engagement) across ALL
-- connected social platforms — Instagram, Facebook Pages, TikTok, LinkedIn,
-- YouTube, X, Threads, etc.
--
-- Design notes:
--   • social_events: append-only event log. Sentiment populated lazily by
--     a Claude-batch worker (sentiment_processed_at = null → still pending).
--   • social_metrics: time-series of post-level + account-level snapshots.
--     Periodic worker fetches /insights from each platform and inserts a
--     row per metric per snapshot.
--   • Both tables reference connection_id as a soft pointer — we don't
--     enforce FK because connections live in platform-specific tables
--     today (role_room_instagram_connections, role_room_linkedin_connections,
--     etc.) and the consolidation migration is a future phase.
--   • platform is the canonical identifier; (platform, account_id) is the
--     stable composite key for cross-platform aggregation.

-- ── Events: comments, mentions, DMs, reactions ──────────────────────────
CREATE TABLE IF NOT EXISTS social_events (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id            uuid,
  platform                 text NOT NULL,
  account_id               text NOT NULL,
  external_event_id        text,
  external_post_id         text,
  external_thread_id       text,
  kind                     text NOT NULL,
  author_external_id       text,
  author_username          text,
  author_display_name      text,
  body                     text,
  language                 text,
  sentiment_score          numeric(4,3),
  sentiment_label          text,
  sentiment_processed_at   timestamptz,
  sentiment_model          text,
  is_read                  boolean NOT NULL DEFAULT false,
  is_actioned              boolean NOT NULL DEFAULT false,
  is_hidden                boolean NOT NULL DEFAULT false,
  occurred_at              timestamptz,
  received_at              timestamptz NOT NULL DEFAULT now(),
  raw                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT social_events_kind_chk CHECK (
    kind IN ('comment', 'reply', 'mention', 'dm', 'reaction', 'review', 'tag', 'share', 'other')
  ),
  CONSTRAINT social_events_sentiment_label_chk CHECK (
    sentiment_label IS NULL
    OR sentiment_label IN ('negative', 'neutral', 'positive', 'mixed')
  )
);

CREATE INDEX IF NOT EXISTS idx_social_events_platform_account
  ON social_events (platform, account_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_events_post
  ON social_events (external_post_id)
  WHERE external_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_events_unread
  ON social_events (platform, account_id, received_at DESC)
  WHERE NOT is_read;

CREATE INDEX IF NOT EXISTS idx_social_events_sentiment_pending
  ON social_events (received_at)
  WHERE sentiment_processed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_events_external
  ON social_events (platform, account_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

COMMENT ON TABLE social_events IS
  'Cross-platform inbound social events (comments, mentions, DMs). Populated by per-platform webhooks; sentiment scored async by Claude batch worker.';

-- ── Metrics: post-level + account-level snapshots ───────────────────────
CREATE TABLE IF NOT EXISTS social_metrics (
  id                  bigserial PRIMARY KEY,
  connection_id       uuid,
  platform            text NOT NULL,
  account_id          text NOT NULL,
  external_post_id    text,
  scope               text NOT NULL,
  metric_name         text NOT NULL,
  metric_value        numeric,
  metric_value_text   text,
  recorded_at         timestamptz NOT NULL DEFAULT now(),
  raw                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT social_metrics_scope_chk CHECK (
    scope IN ('post', 'reel', 'story', 'video', 'account', 'page')
  )
);

CREATE INDEX IF NOT EXISTS idx_social_metrics_post
  ON social_metrics (platform, external_post_id, metric_name, recorded_at DESC)
  WHERE external_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_social_metrics_account
  ON social_metrics (platform, account_id, scope, metric_name, recorded_at DESC);

COMMENT ON TABLE social_metrics IS
  'Time-series of post-level and account-level metric snapshots fetched from platform /insights endpoints.';

-- ── Unified view: social_connections (read-only) ────────────────────────
-- Aggregerer alle plattform-spesifikke connection-tabeller til ett
-- platform-agnostisk view. Brukes av cross-platform UI (unified inbox,
-- analytics dashboard) uten at vi må endre underliggende tabeller.
CREATE OR REPLACE VIEW social_connections_v AS
SELECT
  id::text AS id,
  user_id::text AS user_id,
  project_id::text AS project_id,
  'instagram'::text AS platform,
  ig_business_account_id AS account_id,
  ig_username AS account_username,
  account_type AS account_type,
  profile_picture_url,
  followers_count,
  media_count,
  facebook_page_id AS parent_account_id,
  facebook_page_name AS parent_account_name,
  connection_state,
  token_expires_at,
  created_at,
  updated_at
FROM role_room_instagram_connections;

COMMENT ON VIEW social_connections_v IS
  'Cross-platform unified view over per-platform connection tables. Add UNION ALL clauses as new platforms (TikTok, X, Threads) get dedicated tables.';
