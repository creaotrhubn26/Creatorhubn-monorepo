-- Crew-notifikasjoner (Role Room) — persistert varsel til crew ved tildeling
-- til en produksjonshendelse (ProductionCalendarPanel). Erstatter det aldri-
-- bygde `/crew/:id/notifications`-endepunktet. Kan i tillegg leveres på e-post
-- (channel='email') når crew-medlemmet har en e-postadresse.
CREATE TABLE IF NOT EXISTS role_room_crew_notifications (
  id                 TEXT PRIMARY KEY,
  crew_id            VARCHAR(255) NOT NULL,
  project_id         VARCHAR(255),
  event_id           VARCHAR(255),
  notification_type  TEXT NOT NULL DEFAULT 'assignment',
  channel            TEXT NOT NULL DEFAULT 'in_app',  -- in_app | email | push
  title              TEXT NOT NULL,
  message            TEXT,
  payload            JSONB DEFAULT '{}'::jsonb,
  status             TEXT NOT NULL DEFAULT 'sent',     -- pending | sent | read
  read_at            TIMESTAMPTZ,
  sent_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_crew_notifications_crew_idx
  ON role_room_crew_notifications (crew_id, created_at DESC);
