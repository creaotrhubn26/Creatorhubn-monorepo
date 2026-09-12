-- 249_community_admin.sql
--
-- Schema for community-admin features in Admin Room.
-- Backs `/api/community/admin/*` (admin-community-extras-routes.ts) which
-- drives Admin Room UI: GroupManagement.tsx, RuleManagement.tsx,
-- ModerationManagement.tsx, OnboardingEditor.tsx.
--
-- All tables use IF NOT EXISTS so re-running is idempotent. Route layer is
-- defensive (to_regclass / tableExists) so UI does not crash before this
-- migration runs.
--
-- NOTE: Most community_* tables (community_groups, community_channels,
-- community_roles, community_badges, community_moderation_rules,
-- community_channel_rules) already exist from earlier migrations with
-- richer schemas. This migration only adds the missing admin-managed
-- channel table plus light-pattern promotion plumbing, then ensures the
-- thresholds singleton row is seeded.

-- ── Admin-managed channels ─────────────────────────────────
-- Separate from community_channels (which is owned by the presence
-- subsystem) to keep admin-room edits isolated from per-group runtime
-- state.
CREATE TABLE IF NOT EXISTS community_admin_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES community_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  channel_type TEXT NOT NULL DEFAULT 'public', -- 'public' | 'private' | 'announcement'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_admin_channels_group_idx
  ON community_admin_channels (group_id);

-- ── Light patterns (promotion candidates) ──────────────────
CREATE TABLE IF NOT EXISTS community_light_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name TEXT NOT NULL UNIQUE,
  pattern_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_promoted BOOLEAN NOT NULL DEFAULT FALSE,
  message_count INTEGER NOT NULL DEFAULT 0,
  reaction_count INTEGER NOT NULL DEFAULT 0,
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_light_patterns_promoted_idx
  ON community_light_patterns (is_promoted, message_count DESC);

CREATE TABLE IF NOT EXISTS community_light_pattern_thresholds (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  message_count INTEGER NOT NULL DEFAULT 100,
  reaction_count INTEGER NOT NULL DEFAULT 10,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (id = 'singleton')
);

-- ── Seeds ──────────────────────────────────────────────────
INSERT INTO community_light_pattern_thresholds (id) VALUES ('singleton')
ON CONFLICT (id) DO NOTHING;
