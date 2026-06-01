-- Orchestration runs — persistent state for /api/orchestration/trigger.
--
-- Tidligere var orchestration-state in-memory i orchestration-routes.ts,
-- og trigger-endepunktet rapporterte fake `completed`-status etter 2 sekunder
-- selv om ingenting faktisk hadde kjørt. Det førte til at klienter
-- (f.eks. FotografOrchestrator) viste falsk "Fullført" til brukeren.
--
-- Denne tabellen gir trigger-endepunktet et persistent statusobjekt
-- som status-endepunktet kan lese. Workers (når de finnes) oppdaterer
-- completed_actions/failed_actions etterhvert som de utfører handlinger.
-- Default status er 'queued' — den blir kun 'completed' når en worker
-- faktisk har gjort jobben.

CREATE TABLE IF NOT EXISTS orchestration_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  orchestration_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
    -- queued: persisted, venter på worker
    -- running: worker plukket opp
    -- completed: alle actions ok
    -- partial: noen actions ok, noen feilet
    -- failed: alle actions feilet eller worker krasjet
    -- expired: ingen worker plukket opp innen tidsfristen
    -- stopped: bruker avbrøt manuelt
  trigger_data JSONB DEFAULT '{}'::jsonb,
  completed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes')
);

CREATE INDEX IF NOT EXISTS orchestration_runs_session_idx
  ON orchestration_runs (session_id, started_at DESC);

CREATE INDEX IF NOT EXISTS orchestration_runs_user_idx
  ON orchestration_runs (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS orchestration_runs_active_idx
  ON orchestration_runs (status, expires_at)
  WHERE status IN ('queued', 'running');
