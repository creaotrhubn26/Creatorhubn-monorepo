-- 278_audio_sessions.sql
--
-- Økt-kalender for Audio Showcase: produsenten booker opptak/review/prøve og
-- inviterer band/vokalist; deltakerne svarer (RSVP). Varsel via e-post + .ics.

CREATE TABLE IF NOT EXISTS audio_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES audio_review_projects(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  title         TEXT NOT NULL,
  kind          TEXT NOT NULL DEFAULT 'opptak',   -- opptak | review | prove | mix
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ,
  location      TEXT,
  online_url    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audio_sessions_project ON audio_sessions (project_id, start_at);

CREATE TABLE IF NOT EXISTS audio_session_invitees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES audio_sessions(id) ON DELETE CASCADE,
  member_name  TEXT NOT NULL,
  email        TEXT,
  -- invited | confirmed | declined | tentative
  status       TEXT NOT NULL DEFAULT 'invited',
  responded_at TIMESTAMPTZ,
  UNIQUE (session_id, member_name)
);
