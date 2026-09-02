-- 0497_casting_schedules_audition_link.sql
--
-- Migration 140 targeted the stale table name `schedules`. Role Room uses
-- `casting_schedules`, so the live auditions flow never received its link.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0497_casting_schedules_audition_link'));

ALTER TABLE casting_schedules
  ADD COLUMN IF NOT EXISTS audition_id VARCHAR(255);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'casting_schedules_audition_id_fkey'
       AND conrelid = 'casting_schedules'::regclass
  ) THEN
    ALTER TABLE casting_schedules
      ADD CONSTRAINT casting_schedules_audition_id_fkey
      FOREIGN KEY (audition_id) REFERENCES auditions(id)
      ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE casting_schedules
  VALIDATE CONSTRAINT casting_schedules_audition_id_fkey;

CREATE INDEX IF NOT EXISTS casting_schedules_audition_id_idx
  ON casting_schedules (audition_id)
  WHERE audition_id IS NOT NULL;

COMMIT;
