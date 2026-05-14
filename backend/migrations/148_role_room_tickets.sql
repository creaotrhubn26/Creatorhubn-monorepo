-- Migration 148: role_room_tickets
--
-- Sprint 7.2: Lagrer feedback-tickets fra RoleRoomFeedbackFab. Bruker
-- åpner flytende feedback-knapp inni The Role Room, fyller inn kategori
-- + tittel + beskrivelse + prioritet, og innsendelse persisteres her.
-- Auto-kontekst (URL, tab, viewport, console-error) lagres i context-feltet.

CREATE TABLE IF NOT EXISTS role_room_tickets (
  id              SERIAL PRIMARY KEY,
  category        VARCHAR(24) NOT NULL,   -- bug | feature | question | other
  priority        VARCHAR(16) NOT NULL,   -- low | medium | high | critical
  status          VARCHAR(20) NOT NULL DEFAULT 'open', -- open | in_progress | resolved | closed
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  user_id         TEXT,
  user_email      TEXT,
  user_name       TEXT,
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- url, tab, viewport, UA, console-error
  assigned_to     TEXT,                                  -- admin email (for triage)
  resolution_note TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS role_room_tickets_status_idx
  ON role_room_tickets (status);

CREATE INDEX IF NOT EXISTS role_room_tickets_category_idx
  ON role_room_tickets (category);

CREATE INDEX IF NOT EXISTS role_room_tickets_priority_idx
  ON role_room_tickets (priority);

CREATE INDEX IF NOT EXISTS role_room_tickets_user_email_idx
  ON role_room_tickets (LOWER(user_email));

CREATE INDEX IF NOT EXISTS role_room_tickets_created_at_idx
  ON role_room_tickets (created_at DESC);
