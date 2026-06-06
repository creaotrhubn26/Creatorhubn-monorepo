-- 227_post_engagement_snapshots.sql
--
-- Time-series av engagement-data for publiserte post-drafts. Poller Meta
-- Insights API ved +1h, +24h, +7d, +30d etter publish (eller manuell trigger).
-- Mater AI-rapporten med "hva som funket"-data så Claude kan anbefale
-- mønstre i innholdsstrategien.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS post_engagement_snapshots (
  id                BIGSERIAL PRIMARY KEY,
  draft_id          BIGINT NOT NULL REFERENCES marketing_post_drafts(id) ON DELETE CASCADE,
  external_post_id  TEXT NOT NULL,            -- FB post-id (eg. {page-id}_{post-id})
  platform          TEXT NOT NULL,            -- 'facebook' osv.
  snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  hours_after_publish NUMERIC(8, 2),          -- Tidsavstand fra publish_at
  reactions_total   INTEGER,
  reactions_like    INTEGER,
  reactions_love    INTEGER,
  reactions_other   INTEGER,
  comments_count    INTEGER,
  shares_count      INTEGER,
  -- Insights (krever Page-token + pages_read_engagement scope):
  impressions       INTEGER,
  reach             INTEGER,
  engaged_users     INTEGER,
  clicks            INTEGER,
  -- Beregnede signaler:
  engagement_rate   NUMERIC(5, 4),            -- (reactions + comments + shares) / reach
  raw_insights_json JSONB,
  fetch_error       TEXT
);

CREATE INDEX IF NOT EXISTS idx_post_engagement_snapshots_draft_time
  ON post_engagement_snapshots (draft_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_engagement_snapshots_external
  ON post_engagement_snapshots (external_post_id, snapshot_at DESC);

-- Brukt av AI-rapport-context: "top performers siste 30d"
CREATE INDEX IF NOT EXISTS idx_post_engagement_snapshots_latest_per_draft
  ON post_engagement_snapshots (draft_id, snapshot_at DESC)
  WHERE fetch_error IS NULL;
