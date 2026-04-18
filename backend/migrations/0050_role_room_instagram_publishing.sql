-- 0050_role_room_instagram_publishing.sql
-- Instagram Graph API publishing for The Role Room feed-planner.
--
-- Two tables:
--   role_room_instagram_connections — per-user OAuth tokens for IG Business
--     accounts. Long-lived user access tokens (60 days), refreshed
--     automatically before expiry. The refresh token is encrypted at rest
--     using the same scheme as role_room_google_connections.
--
--   role_room_instagram_publish_jobs — queue of publish operations. Each
--     row tracks one IG publish attempt: container creation, then
--     media_publish. Status transitions: queued → uploading → container →
--     publishing → published | failed.

CREATE TABLE IF NOT EXISTS role_room_instagram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id TEXT,                                  -- nullable: connection can be project-scoped or user-wide
  ig_business_account_id TEXT NOT NULL,             -- IG Business Account ID (NOT the @username)
  ig_username TEXT,                                 -- @handle for display
  facebook_page_id TEXT NOT NULL,                   -- linked FB Page (required by Meta to publish)
  facebook_page_name TEXT,
  access_token_encrypted TEXT NOT NULL,             -- long-lived user token, encrypted
  token_expires_at TIMESTAMPTZ,                     -- when the token expires (60 days typical)
  scopes TEXT[] NOT NULL DEFAULT '{}',              -- granted scopes
  connection_state TEXT NOT NULL DEFAULT 'connected'
    CHECK (connection_state IN ('connected', 'expired', 'revoked', 'error')),
  last_refreshed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active connection per (user, ig_business_account); old rows kept for audit.
CREATE UNIQUE INDEX IF NOT EXISTS role_room_instagram_connections_active_user_idx
  ON role_room_instagram_connections (user_id, ig_business_account_id)
  WHERE connection_state = 'connected';

CREATE INDEX IF NOT EXISTS role_room_instagram_connections_project_idx
  ON role_room_instagram_connections (project_id, connection_state, last_refreshed_at DESC);

CREATE TABLE IF NOT EXISTS role_room_instagram_publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  connection_id UUID NOT NULL REFERENCES role_room_instagram_connections(id) ON DELETE CASCADE,
  feed_plan_post_id TEXT NOT NULL,                  -- references the post.id inside role_room_feed_plans.posts
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'reel', 'carousel')),
  caption TEXT NOT NULL DEFAULT '',
  image_public_url TEXT,                            -- R2-hosted URL Meta fetched
  ig_container_id TEXT,                             -- creation_id from Meta
  ig_media_id TEXT,                                 -- final published media id
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'uploading', 'container', 'publishing', 'published', 'failed', 'rate_limited')),
  scheduled_for TIMESTAMPTZ,                        -- when the user wants it published
  attempted_count INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_instagram_publish_jobs_status_idx
  ON role_room_instagram_publish_jobs (status, scheduled_for);

CREATE INDEX IF NOT EXISTS role_room_instagram_publish_jobs_project_idx
  ON role_room_instagram_publish_jobs (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_instagram_publish_jobs_connection_idx
  ON role_room_instagram_publish_jobs (connection_id, created_at DESC);

-- Helper view: rolling 24h count per connection — used to enforce Meta's
-- 50 publishes / 24h hard limit before we even call the API.
CREATE OR REPLACE VIEW role_room_instagram_publishes_last_24h AS
  SELECT connection_id,
         COUNT(*) AS published_count
    FROM role_room_instagram_publish_jobs
   WHERE status = 'published'
     AND published_at > now() - interval '24 hours'
   GROUP BY connection_id;

COMMENT ON TABLE role_room_instagram_connections IS
  'Per-user IG Business Account OAuth connections. access_token_encrypted is the long-lived (60d) Meta user token, refreshed automatically before expiry. connection_state tracks usability.';

COMMENT ON TABLE role_room_instagram_publish_jobs IS
  'Queue of IG publishes. Lifecycle: queued → uploading (R2) → container (POST /media) → publishing (POST /media_publish) → published | failed | rate_limited. Connection-scoped.';
