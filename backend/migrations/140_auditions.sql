-- Migration 140: auditions
--
-- Audition-entitet — grupperer relaterte schedule-rader til én logisk
-- audition. Tidligere ble dette utledet synthetisk i frontend basert på
-- (date, time, role, location)-matching, men det skalerer ikke når
-- backenden trenger å:
--   - Sende e-post/SMS-påminnelser per audition (ikke per kandidat)
--   - Knytte audition-nivå-notater og kontrakter
--   - Aggregere statistikker per audition for produsent-rapporter
--   - Tilby AvatarGroup-visning i AuditionSchedulePanel uten å duplisere
--     grupperings-logikk
--
-- Modell:
--   auditions = container med title/project/role/location/date/time.
--   schedules.audition_id = FK til auditions (NULL for eldre rader som
--     ikke er gruppert ennå — backwards-compat).
--   Status på audition aggregeres fra child-schedules (eldste status =
--     audition-status, eller eksplisitt overstyrt via audition.status).
--
-- Backwards-compat:
--   - Eksisterende schedules forblir gyldige med NULL audition_id.
--   - Frontend kan fortsette å bruke synthetisk grupperting som fallback.
--   - Nye schedules som opprettes via batch-audition-flow får
--     audition_id automatisk.

CREATE TABLE IF NOT EXISTS auditions (
  id                varchar PRIMARY KEY,
  project_id        varchar NOT NULL,
  title             text NOT NULL,
  -- Tilknytning til rolle/lokasjon (matchet via synthetisk-grupperings-
  -- nøkkelen i frontend, men eksplisitt her for query-fart)
  role_id           varchar,
  role_name         text,
  location_id       varchar,
  location_name     text,
  -- Dato + tid for audition-slottet (ikke per-kandidat-tid — det er på
  -- schedules-raden). Et audition-slot kan ha flere kandidat-tider.
  date              date NOT NULL,
  start_time        time,
  end_time          time,
  -- Status-aggregat: scheduled / confirmed / awaiting_callback / completed
  -- / cancelled. Default scheduled. Frontend kan overstyre.
  status            varchar(20) DEFAULT 'scheduled',
  -- Team-medlemmer (casting director, assistant) — JSON array av
  -- { crewId: string, role: string } for AvatarGroup-visning.
  team_members      jsonb DEFAULT '[]'::jsonb,
  -- Audition-nivå-notater (visjon, fokus, kjøreplan)
  notes             text,
  -- Audit-felter
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  created_by        varchar,
  updated_by        varchar
);

CREATE INDEX IF NOT EXISTS auditions_project_id_idx ON auditions (project_id);
CREATE INDEX IF NOT EXISTS auditions_date_idx ON auditions (project_id, date);
CREATE INDEX IF NOT EXISTS auditions_role_id_idx ON auditions (role_id) WHERE role_id IS NOT NULL;

-- Knytt schedules til auditions. Backwards-compat: NULL = eldre rad uten
-- audition-grupperting.
ALTER TABLE IF EXISTS schedules
  ADD COLUMN IF NOT EXISTS audition_id varchar REFERENCES auditions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS schedules_audition_id_idx
  ON schedules (audition_id) WHERE audition_id IS NOT NULL;

-- Trigger som auto-oppdaterer updated_at ved hver UPDATE.
CREATE OR REPLACE FUNCTION auditions_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auditions_updated_at_trigger ON auditions;
CREATE TRIGGER auditions_updated_at_trigger
  BEFORE UPDATE ON auditions
  FOR EACH ROW
  EXECUTE FUNCTION auditions_set_updated_at();
