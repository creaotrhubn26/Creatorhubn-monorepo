-- Slice 9X.79 — Tillat 'cancelled' som workflow_runs-status
--
-- Engine markerer runet som 'cancelled' når brukeren trykker "Stopp".
-- Resterende steg får status 'skipped'. Den aktuelle runner-loopen
-- poller status mellom hvert steg og avslutter tidlig.

DO $$
BEGIN
  -- Drop og recreate CHECK-constraint så 'cancelled' tillates
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workflow_runs_status_check'
  ) THEN
    ALTER TABLE workflow_runs DROP CONSTRAINT workflow_runs_status_check;
  END IF;

  ALTER TABLE workflow_runs
    ADD CONSTRAINT workflow_runs_status_check
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'partial', 'cancelled'));
EXCEPTION WHEN undefined_table THEN
  -- workflow_runs ikke opprettet enda; 0147 oppretter den med riktig liste etter at den blir patchet
  NULL;
END $$;
