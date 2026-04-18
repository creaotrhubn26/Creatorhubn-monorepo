-- 0049_role_room_feed_post_templates.sql
-- Reusable post templates for the Role Room feed-planner. A template
-- captures the editable fields of a post (concept, title, caption, CTA,
-- hashtags, media type, logo placement, brand colors) so producers can
-- save successful posts and re-apply them to future ones.
--
-- Scope: per (project_id, owner_user_id). Templates do NOT carry the
-- customImageUrl — images are post-specific and stay attached to the
-- individual post. Brand colors and accent are kept so the template
-- preserves the visual feel even if applied to a different brand.

CREATE TABLE IF NOT EXISTS role_room_feed_post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
  name TEXT NOT NULL,
  template JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS role_room_feed_post_templates_project_idx
  ON role_room_feed_post_templates (project_id, platform, archived_at);

CREATE INDEX IF NOT EXISTS role_room_feed_post_templates_owner_idx
  ON role_room_feed_post_templates (owner_user_id, updated_at DESC);

COMMENT ON TABLE role_room_feed_post_templates IS
  'Reusable post templates per (project, platform). The template JSONB stores caption, hashtags, CTA, media type, logo placement and brand colors — everything except the per-post customImageUrl.';
