-- 0527_leadgrid_visit_idempotency.sql
--
-- Durable opt-in idempotency for Leadgrid's canonical visit/contact log.
-- Older clients may continue writing NULL keys; newer clients use one UUID per
-- user action and the service compares a canonical SHA-256 request hash.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE crm_visits
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS request_hash CHAR(64);

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'crm_visits'::regclass
       AND conname = 'crm_visits_idempotency_pair_check'
  ) THEN
    ALTER TABLE crm_visits
      ADD CONSTRAINT crm_visits_idempotency_pair_check
      CHECK (
        (idempotency_key IS NULL) = (request_hash IS NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'crm_visits'::regclass
       AND conname = 'crm_visits_request_hash_format_check'
  ) THEN
    ALTER TABLE crm_visits
      ADD CONSTRAINT crm_visits_request_hash_format_check
      CHECK (
        request_hash IS NULL
        OR request_hash ~ '^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;
END
$migration$;

ALTER TABLE crm_visits
  VALIDATE CONSTRAINT crm_visits_idempotency_pair_check;
ALTER TABLE crm_visits
  VALIDATE CONSTRAINT crm_visits_request_hash_format_check;

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_visits_customer_user_idempotency
  ON crm_visits(customer_id, user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN crm_visits.idempotency_key IS
  'Optional UUID supplied by Idempotency-Key; unique per lead and user.';
COMMENT ON COLUMN crm_visits.request_hash IS
  'SHA-256 of the canonical accepted visit payload plus lead id.';

COMMIT;
