-- 300_role_room_meetings.sql
-- Møte-flyt i Creative Sync Workspace (Møter-fanen). Egen modell (bevisst
-- IKKE role_room_project_meeting — det navnet er reservert av ucommittet
-- parallell-arbeid) for å unngå kollisjon. Planlegg møte → Google Meet-lenke
-- (createGoogleMeetLink) + Google Calendar-event → kommende møter (produsent +
-- klient) → auto-koblet møtenotat etterpå.

CREATE TABLE IF NOT EXISTS role_room_meetings (
  id                 UUID PRIMARY KEY,
  project_id         VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title              VARCHAR(255) NOT NULL,
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  time_zone          VARCHAR(64) NOT NULL DEFAULT 'Europe/Oslo',
  participants       JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{name,email,role}]
  meet_link          TEXT,                                  -- Google Meet URL
  calendar_event_id  TEXT,                                  -- Google Calendar event id
  location           TEXT,
  status             VARCHAR(24) NOT NULL DEFAULT 'upcoming', -- upcoming | completed | cancelled
  notes              TEXT,                                  -- møtenotat / referat
  notes_status       VARCHAR(24) NOT NULL DEFAULT 'pending', -- pending | ready
  agenda             JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_items       JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{text,owner,done}]
  client_visible     BOOLEAN NOT NULL DEFAULT TRUE,         -- synlig i klient-portalen
  created_by_user_id VARCHAR(255),
  created_by_role    VARCHAR(80),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kommende/forrige møter sorteres på starttid per prosjekt.
CREATE INDEX IF NOT EXISTS idx_rr_meetings_project_start
  ON role_room_meetings (project_id, starts_at DESC NULLS LAST, created_at DESC);

COMMENT ON TABLE role_room_meetings IS
  'Møter i Creative Sync Workspace: planlegging + Google Meet/Calendar-kobling + møtenotat, delt produsent↔klient.';
