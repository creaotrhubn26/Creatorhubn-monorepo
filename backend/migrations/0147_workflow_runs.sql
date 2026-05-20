-- Slice 9X.79 — SmartFlyt execution-engine
--
-- Persister hver workflow-utførelse + per-step-status, slik at brukeren
-- ser ekte progress og kan re-prøve feilede steg uten å miste tidligere
-- progresjon.

CREATE TABLE IF NOT EXISTS workflow_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     TEXT NOT NULL,
  workflow_name   TEXT NOT NULL,
  user_id         TEXT NOT NULL,
  profession      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'partial')),
  context         JSONB DEFAULT '{}'::jsonb,
  steps_total     INTEGER NOT NULL,
  steps_completed INTEGER NOT NULL DEFAULT 0,
  steps_failed    INTEGER NOT NULL DEFAULT 0,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_user
  ON workflow_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status
  ON workflow_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS workflow_run_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  step_index      INTEGER NOT NULL,
  action_id       TEXT NOT NULL,
  action_name     TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'awaiting_manual')),
  execution_mode  TEXT CHECK (execution_mode IN ('auto', 'manual', 'ai')),
  result_data     JSONB,
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_workflow_run_steps_run
  ON workflow_run_steps (run_id, step_index);
