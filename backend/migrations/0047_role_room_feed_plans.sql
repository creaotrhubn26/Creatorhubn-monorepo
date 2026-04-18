-- 0047_role_room_feed_plans.sql
-- Social feed planner addon for The Role Room Agent.
--
-- One row per (project_id, platform). `posts` holds the ordered list of
-- planned posts as JSONB so layout, caption, hashtags, CTA and placeholder
-- styling can evolve without schema migrations.

CREATE TABLE IF NOT EXISTS role_room_feed_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
  posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  brand_snapshot JSONB,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_feed_plans_project_platform_idx
  ON role_room_feed_plans (project_id, platform);

COMMENT ON TABLE role_room_feed_plans IS
  'Planned social feed (grid + content schedule) per project and platform. `posts` is an ordered JSONB array; `brand_snapshot` captures the brand guide at last edit so the preview stays consistent if bootstrap is re-run.';
