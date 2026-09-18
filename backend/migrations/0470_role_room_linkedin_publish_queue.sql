-- Durable LinkedIn publishing for Role Room Feed Planner.
--
-- Jobs keep only encrypted-credential references plus R2 object metadata;
-- OAuth tokens and raw data URLs never enter this table. The partial due and
-- processing indexes support multi-instance workers using SKIP LOCKED.

BEGIN;

-- Project-scoped client connections coexist with the producer's global
-- personal connection. Ship this schema before route traffic so deploys do
-- not depend on runtime DDL privileges.
ALTER TABLE role_room_linkedin_connections
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);

DROP INDEX IF EXISTS idx_rr_linkedin_connections_user_id_unique;
DROP INDEX IF EXISTS idx_rr_linkedin_connections_member_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_user_project_unique
  ON role_room_linkedin_connections (user_id, COALESCE(project_id, ''));

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_linkedin_member_project_unique
  ON role_room_linkedin_connections (linkedin_member_id, COALESCE(project_id, ''));

CREATE INDEX IF NOT EXISTS idx_rr_linkedin_project
  ON role_room_linkedin_connections (project_id)
  WHERE project_id IS NOT NULL;

-- OAuth state and the short-lived hand-off must survive redirects landing on
-- another app instance. State/transfer rows are consumed with DELETE ...
-- RETURNING in the application and expire after fifteen minutes.
CREATE TABLE IF NOT EXISTS role_room_oauth_pending_state (
  state_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_state_expires
  ON role_room_oauth_pending_state (expires_at);

CREATE TABLE IF NOT EXISTS role_room_oauth_pending_transfer (
  transfer_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_transfer_expires
  ON role_room_oauth_pending_transfer (expires_at);

CREATE TABLE IF NOT EXISTS role_room_linkedin_publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  feed_plan_post_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 240),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('text', 'image', 'carousel', 'video', 'reel', 'link')),
  caption TEXT NOT NULL CHECK (char_length(caption) BETWEEN 1 AND 3000),
  extras JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_type TEXT NOT NULL DEFAULT 'personal' CHECK (author_type IN ('personal', 'organization')),
  organization_urn TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'publishing', 'published', 'failed', 'uncertain')
  ),
  scheduled_for TIMESTAMPTZ NOT NULL,
  available_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  claimed_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  last_error TEXT,
  external_post_id TEXT,
  permalink TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rr_linkedin_publish_author_check CHECK (
    (author_type = 'personal' AND organization_urn IS NULL)
    OR
    (author_type = 'organization' AND organization_urn LIKE 'urn:li:organization:%')
  )
);

DROP INDEX IF EXISTS idx_rr_linkedin_publish_idempotency;
CREATE UNIQUE INDEX idx_rr_linkedin_publish_idempotency
  ON role_room_linkedin_publish_jobs (user_id, idempotency_key)
  WHERE status IN ('queued', 'processing', 'publishing', 'published', 'uncertain');

DROP INDEX IF EXISTS idx_rr_linkedin_publish_active_feed_post;
CREATE UNIQUE INDEX idx_rr_linkedin_publish_active_feed_post
  ON role_room_linkedin_publish_jobs (project_id, feed_plan_post_id)
  WHERE status IN ('queued', 'processing', 'publishing', 'uncertain');

CREATE INDEX IF NOT EXISTS idx_rr_linkedin_publish_due
  ON role_room_linkedin_publish_jobs (available_at, created_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_rr_linkedin_publish_processing
  ON role_room_linkedin_publish_jobs (claimed_at)
  WHERE status IN ('processing', 'publishing');

CREATE INDEX IF NOT EXISTS idx_rr_linkedin_publish_project
  ON role_room_linkedin_publish_jobs (project_id, created_at DESC)
  WHERE project_id IS NOT NULL;

COMMIT;
