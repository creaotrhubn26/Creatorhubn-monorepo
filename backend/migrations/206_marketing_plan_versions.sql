-- 206_marketing_plan_versions.sql
-- Versjonering for markedsplanen — analog til research-versjonering
-- (migration 205). Hver gang Daniel re-genererer en markedsplan,
-- lagrer vi snapshot av plan + pillars (+ posts hvis genererte) slik
-- at han kan rulle tilbake.
--
-- Snapshot er JSONB med tre nøkler:
--   { plan: {...}, pillars: [...], posts: [...] }
-- Slik at full state kan rekonstrueres ved activate.

CREATE TABLE IF NOT EXISTS role_room_marketing_plans_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  plan_id UUID,
  version_number INT NOT NULL,
  label TEXT,
  snapshot JSONB NOT NULL,
  generated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  generated_by_kind TEXT NOT NULL DEFAULT 'agent'
    CHECK (generated_by_kind IN ('user', 'agent')),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);

CREATE INDEX IF NOT EXISTS role_room_marketing_plans_versions_project_idx
  ON role_room_marketing_plans_versions (project_id, version_number DESC);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_marketing_plans_versions_active_idx
  ON role_room_marketing_plans_versions (project_id)
  WHERE is_active = TRUE;

COMMENT ON TABLE role_room_marketing_plans_versions IS
  'Append-only historikk for markedsplaner. Snapshot = { plan, pillars, posts } JSONB. is_active=true markerer hvilken versjon som er live.';
