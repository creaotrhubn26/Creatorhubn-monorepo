-- 288_role_room_project_meeting.sql
-- The Role Room prosjektrom-møtenotater (egen, prosjekt-scoped — ikke
-- Creatorhub-assistentens generiske meeting_*-tabeller). Tittel, dato,
-- deltakere, agenda og handlingspunkter lagres som JSONB. Soft-refs.

CREATE TABLE IF NOT EXISTS role_room_project_meeting (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    TEXT NOT NULL,
  owner_user_id TEXT,
  title         TEXT NOT NULL DEFAULT 'Møte',
  meeting_date  DATE,
  participants  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["Navn", ...]
  agenda        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- ["punkt", ...]
  action_items  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{text, owner, done}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_role_room_project_meeting_project
  ON role_room_project_meeting (project_id, meeting_date DESC NULLS LAST, created_at DESC);
