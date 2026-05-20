-- 0143 — Milepæler per jobbsøknad
--
-- En jobbsøknad har gjerne 2-4 parallelle deadlines (søknadsfrist,
-- case-frist, intervju-dato, forventet svar). Vi modellerer det som
-- en sekvens av milepæler — IKKE som ekstra kolonner på job_applications
-- — fordi én søknad kan ha flere caser (round 1 + round 2) og flere
-- intervjuer (HR, fagperson, leder).
--
-- Reminder-stigen håndteres separat av cron-jobben som leser milepæler
-- og setter status_updated_at når en påminnelse er sendt.

CREATE TABLE IF NOT EXISTS job_application_milestones (
  id              VARCHAR(64) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  application_id  VARCHAR(64) NOT NULL
                  REFERENCES job_applications(id) ON DELETE CASCADE,
  user_id         VARCHAR(255) NOT NULL,

  kind            VARCHAR(32) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  due_at          TIMESTAMPTZ NOT NULL,

  -- JSONB-array av ISO-timestamps når påminnelse bør gå ut
  -- (default: [48h_før, 24h_før, 2h_før])
  reminder_at     TIMESTAMPTZ[],
  reminders_sent  TIMESTAMPTZ[],

  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  artifact_url    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT job_application_milestones_kind_chk CHECK (
    kind IN ('application_deadline','case_deadline','interview',
             'expected_response','custom')
  )
);

CREATE INDEX IF NOT EXISTS job_application_milestones_application_idx
  ON job_application_milestones (application_id);
CREATE INDEX IF NOT EXISTS job_application_milestones_user_due_idx
  ON job_application_milestones (user_id, due_at)
  WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS job_application_milestones_pending_reminders_idx
  ON job_application_milestones (due_at)
  WHERE completed_at IS NULL;
