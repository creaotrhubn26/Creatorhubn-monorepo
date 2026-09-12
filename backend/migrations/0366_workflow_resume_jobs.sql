-- =====================================================================
-- mig 0366 — Workflow wait-scheduler (resume-jobber)
--
-- `wait`-action i workflow-engine var en no-op (logget «deferred» og
-- fortsatte umiddelbart) — auto_followup_7_days ville sendt oppfølging
-- samtidig med velkomsten. Nå: engine persisterer en resume-jobb ved
-- wait og STOPPER; en poller (5 min) gjenopptar kjøringen fra neste
-- action når resume_at er passert.
--
-- Aktivitets-guard: auto_followup-semantikken er «hvis ikke noe har
-- skjedd» — polleren hopper over jobben hvis leaden har fått aktivitet
-- (crm_lead_activities) etter at wait startet.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS leadgrid_workflow_resume_jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id        UUID NOT NULL REFERENCES leadgrid_workflows(id) ON DELETE CASCADE,
  organization_id    VARCHAR(255) NOT NULL,
  lead_id            VARCHAR(255),
  -- Original-eventet (type/data/actorUserId) — gjenskapes ved resume.
  event              JSONB NOT NULL,
  -- Index i workflow.actions å fortsette FRA (wait-index + 1).
  next_action_index  INTEGER NOT NULL,
  -- Kjøringen som planla wait-en (audit-kobling).
  parent_execution_id UUID,
  resume_at          TIMESTAMPTZ NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','running','done','skipped','cancelled','failed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resumed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workflow_resume_due
  ON leadgrid_workflow_resume_jobs(resume_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_workflow_resume_workflow
  ON leadgrid_workflow_resume_jobs(workflow_id, status);

COMMIT;
