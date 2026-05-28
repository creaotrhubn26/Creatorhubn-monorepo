-- 0076_dance_audition.sql
-- Åpne auditions for frilansdansere (og evt. studio-bruk).
-- Erstatter den tidligere DEMO_AUDITIONS-stuben i DanceDashboard.
--
-- Modell:
--   dance_audition — én rad per audition/oppdrag, scoped på owner_user_id
--                   (+ valgfri project_id), med søknadsfrist, status og
--                   applied-flagg slik dashboardet allerede forventer å vise.

CREATE TABLE IF NOT EXISTS dance_audition (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  organizer TEXT NOT NULL,
  deadline TIMESTAMPTZ,
  audition_date TIMESTAMPTZ,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  applied_at TIMESTAMPTZ,
  source_url TEXT,
  fee_kr INTEGER,
  requirements TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT dance_audition_status_values
    CHECK (status IN ('open','applied','shortlisted','rejected','accepted','withdrawn','closed'))
);

CREATE INDEX IF NOT EXISTS dance_audition_owner_deadline_idx
  ON dance_audition (owner_user_id, deadline ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS dance_audition_project_idx
  ON dance_audition (owner_user_id, project_id);
CREATE INDEX IF NOT EXISTS dance_audition_owner_status_idx
  ON dance_audition (owner_user_id, status);
