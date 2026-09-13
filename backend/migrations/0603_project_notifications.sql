-- 0603_project_notifications.sql
--
-- Hendelsesinnboks for CreatorHub-workspace. Modellen er den prod-herdede
-- `role_room_project_notifications` (0491), men UTEN fremmednøkkel mot noe
-- prosjektlager: `project_id` er den samme nakne VARCHAR-nøkkelen som
-- `project_board_tasks` og `project_team_members` bruker, fordi tilgangslaget
-- (`canAccessProject`) behandler public.projects, legacy.projects og
-- casting_projects som ett id-rom — og `legacy` eies ikke av migrasjonsrollen.
--
-- Role Rooms to tabeller (notifications + reads) er slått sammen til én
-- mottakertabell: en rad per mottaker med `read_at NULL` = ulest. Den er
-- samtidig leveranseloggen, så «hvem skulle ha dette» avgjøres én gang ved
-- skriving (av prosjektteamet), ikke på nytt for hvert innboks-oppslag.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0603_project_notifications'));

CREATE TABLE IF NOT EXISTS project_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          VARCHAR(64) NOT NULL,
  audience            VARCHAR(32) NOT NULL DEFAULT 'team'
                        CHECK (audience IN ('team', 'client', 'external')),
  event_type          VARCHAR(100) NOT NULL,
  title               VARCHAR(255) NOT NULL,
  message             TEXT,
  linked_entity_type  VARCHAR(100),
  linked_entity_id    VARCHAR(255),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id  VARCHAR(64),
  created_by_label    VARCHAR(255),
  assigned_to_user_id VARCHAR(64),
  assigned_to_label   VARCHAR(255),
  due_at              TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  resolved_by_user_id VARCHAR(64),
  archived_at         TIMESTAMPTZ,
  archived_by_user_id VARCHAR(64),
  -- Logisk hendelsesnøkkel. Fristvarsler evalueres ved lesing (ingen cron), så
  -- den samme forfallende leveransen må kollapse til én rad uansett hvor mange
  -- teammedlemmer som åpner bjella.
  dedupe_key          VARCHAR(255),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolonnene legges også til eksplisitt slik at en delvis opprettet tabell fra
-- en tidligere kjøring får dem. Migrasjonen skal kunne kjøres på nytt.
ALTER TABLE project_notifications
  ADD COLUMN IF NOT EXISTS linked_entity_type  VARCHAR(100),
  ADD COLUMN IF NOT EXISTS linked_entity_id    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS created_by_label    VARCHAR(255),
  ADD COLUMN IF NOT EXISTS assigned_to_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS assigned_to_label   VARCHAR(255),
  ADD COLUMN IF NOT EXISTS due_at              TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS archived_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by_user_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS dedupe_key          VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_project_notifications_project
  ON project_notifications (project_id, created_at DESC)
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_notifications_due
  ON project_notifications (project_id, due_at)
  WHERE due_at IS NOT NULL AND resolved_at IS NULL AND archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_notifications_dedupe
  ON project_notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS project_notification_recipients (
  notification_id UUID NOT NULL
    REFERENCES project_notifications(id) ON DELETE CASCADE,
  user_id         VARCHAR(64) NOT NULL,
  read_at         TIMESTAMPTZ,
  PRIMARY KEY (notification_id, user_id)
);

-- Bjella spør «mine uleste, nyeste først» på hver visning. Delvis indeks fordi
-- uleste er den lille halen; leste rader trenger ingen indeksplass her.
CREATE INDEX IF NOT EXISTS idx_project_notification_recipients_unread
  ON project_notification_recipients (user_id)
  WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_project_notification_recipients_user
  ON project_notification_recipients (user_id, notification_id);

COMMIT;
