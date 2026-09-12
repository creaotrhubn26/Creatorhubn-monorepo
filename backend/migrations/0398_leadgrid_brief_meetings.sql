-- 0398: Dørsalg brief-møter — salgssjef/teamleder samler teamet før felt.
-- Dørsalg-selgere har ingen lead-møter; Møter-fanen deres drives av disse.
-- Gjentakelse lagres som regel (none/daily/weekdays/weekly) og ekspanderes
-- til forekomster i klienten.

CREATE TABLE IF NOT EXISTS leadgrid_brief_meetings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       TEXT NOT NULL,
  title        TEXT NOT NULL,
  note         TEXT NOT NULL DEFAULT '',
  start_at     TIMESTAMPTZ NOT NULL,           -- første forekomst
  duration_min INT NOT NULL DEFAULT 15,
  recurrence   TEXT NOT NULL DEFAULT 'none'
               CHECK (recurrence IN ('none', 'daily', 'weekdays', 'weekly')),
  participants JSONB NOT NULL DEFAULT '[]',    -- [user_id, ...]
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_brief_meetings_org
  ON leadgrid_brief_meetings (org_id, start_at);
