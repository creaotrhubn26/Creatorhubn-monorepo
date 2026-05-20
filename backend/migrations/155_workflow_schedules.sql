-- Slice 9X.79 — Planlagte SmartFlyt-workflows
--
-- Stine kan si "kjør 'backup-prosjekter' hver søndag kl 22" og det skjer
-- automatisk uten manuell trigger. Backend-scheduler poller hvert 60s
-- og kaller startWorkflowRun() for alle workflows som er due.

CREATE TABLE IF NOT EXISTS workflow_schedules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  profession    TEXT,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('daily', 'weekly', 'monthly')),
  schedule_hour INTEGER NOT NULL CHECK (schedule_hour BETWEEN 0 AND 23),
  schedule_dow  INTEGER, -- 0=søn, 6=lør for weekly; 1-28 for monthly; NULL for daily
  timezone      TEXT NOT NULL DEFAULT 'Europe/Oslo',
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at   TIMESTAMPTZ NOT NULL,
  last_run_at   TIMESTAMPTZ,
  last_run_id   UUID,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (workflow_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_schedules_due
  ON workflow_schedules (enabled, next_run_at)
  WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_schedules_user
  ON workflow_schedules (user_id);
