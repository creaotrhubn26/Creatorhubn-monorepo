-- migration-role: creatorhub_migrator
-- 0508: Stable, idempotent links between Role Room Feed Planner posts and
-- existing Post Agent Mockup Studio projects.
--
-- The relation deliberately stores identifiers and sync metadata only. The
-- feed plan remains the source of truth for copy/schedule/approval, while the
-- Mockup Studio project remains the source of truth for the editable design.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0508_role_room_feed_mockup_links'));

CREATE TABLE IF NOT EXISTS role_room_feed_mockup_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
  feed_post_id TEXT NOT NULL CHECK (length(feed_post_id) BETWEEN 1 AND 255),
  mockup_project_id TEXT NOT NULL,
  mockup_created_by TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  last_applied_revision INTEGER CHECK (last_applied_revision IS NULL OR last_applied_revision > 0),
  last_applied_sha256 VARCHAR(64)
    CHECK (last_applied_sha256 IS NULL OR last_applied_sha256 ~ '^[0-9a-f]{64}$'),
  last_applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_room_feed_mockup_links_mockup_fk
    FOREIGN KEY (mockup_project_id, mockup_created_by)
    REFERENCES mockup_studio_project_state(project_id, created_by) ON DELETE CASCADE,
  CONSTRAINT role_room_feed_mockup_links_unique
    UNIQUE (
      workspace_project_id,
      platform,
      feed_post_id,
      mockup_project_id,
      mockup_created_by
    )
);

CREATE INDEX IF NOT EXISTS role_room_feed_mockup_links_feed_post_idx
  ON role_room_feed_mockup_links (workspace_project_id, platform, feed_post_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS role_room_feed_mockup_links_mockup_idx
  ON role_room_feed_mockup_links (mockup_project_id, mockup_created_by, updated_at DESC);

COMMENT ON TABLE role_room_feed_mockup_links IS
  'Identifier-only bridge between Feed Planner posts and existing Mockup Studio projects; no project, post, or asset payload is duplicated.';
COMMENT ON COLUMN role_room_feed_mockup_links.feed_post_id IS
  'Application-validated identifier inside role_room_feed_plans.posts JSONB; it cannot be a relational FK while posts are stored as JSONB.';
COMMENT ON COLUMN role_room_feed_mockup_links.last_applied_sha256 IS
  'SHA-256 of the most recently applied render, used with the current feed image to make repeated sends idempotent.';

COMMIT;
