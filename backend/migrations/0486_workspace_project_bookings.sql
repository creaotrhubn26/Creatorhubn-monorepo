-- Workspace-bookinger må kunne eksistere uten en CRM-kunde. Vi beholder
-- crm_meetings som felles sannhetskilde for Avtaler/CRM, men legger på en
-- eksplisitt prosjektkobling og sannferdig status for lokal/Google-synk.

CREATE TABLE IF NOT EXISTS crm_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  title TEXT,
  description TEXT,
  location TEXT,
  meet_link TEXT,
  web_view_url TEXT,
  scheduled_at TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 60,
  profession TEXT,
  owner_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE crm_meetings
  ADD COLUMN IF NOT EXISTS project_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_status VARCHAR(24) NOT NULL DEFAULT 'not_requested',
  ADD COLUMN IF NOT EXISTS calendar_sync_error TEXT,
  ADD COLUMN IF NOT EXISTS calendar_owner_user_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_sync_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS calendar_sync_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Eksisterende CRM-møter arver både prosjekt og kanonisk eier fra kunden.
-- Eierfeltet er nødvendig fordi konfliktkontrollen dekker hele eierens
-- arbeidskalender på tvers av prosjekter.
UPDATE crm_meetings AS meeting
   SET project_id = COALESCE(meeting.project_id, customer.project_id),
       owner_user_id = COALESCE(meeting.owner_user_id, customer.owner_user_id),
       updated_at = NOW()
  FROM crm_customers AS customer
 WHERE meeting.customer_id = customer.id
   AND (meeting.project_id IS NULL OR meeting.owner_user_id IS NULL);

-- Rader uten CRM-kunde får eier fra prosjektet. Begge prosjekt-namespace må
-- støttes fordi Enterprise-workspaces kan ligge i legacy.projects.
UPDATE crm_meetings AS meeting
   SET owner_user_id = project.user_id::text,
       updated_at = NOW()
  FROM projects AS project
 WHERE meeting.project_id::text = project.id::text
   AND meeting.owner_user_id IS NULL;

UPDATE crm_meetings AS meeting
   SET owner_user_id = project.user_id::text,
       updated_at = NOW()
  FROM legacy.projects AS project
 WHERE meeting.project_id::text = project.id::text
   AND meeting.owner_user_id IS NULL;

-- Eldre rader kan ha Meet-lenke, men ingen lagret Google event-id. Merk dem
-- som ekstern lenke i stedet for å late som toveis kalendersynk er aktiv.
UPDATE crm_meetings
   SET calendar_sync_status = 'external_link',
       updated_at = NOW()
 WHERE meet_link IS NOT NULL
   AND calendar_event_id IS NULL
   AND calendar_sync_status = 'not_requested';

CREATE INDEX IF NOT EXISTS crm_meetings_project_scheduled_idx
  ON crm_meetings (project_id, scheduled_at);

CREATE INDEX IF NOT EXISTS crm_meetings_project_status_idx
  ON crm_meetings (project_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS crm_meetings_owner_status_scheduled_idx
  ON crm_meetings (owner_user_id, status, scheduled_at);
