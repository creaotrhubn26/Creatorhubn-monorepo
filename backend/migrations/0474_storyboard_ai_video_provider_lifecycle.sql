-- Durable provider lifecycle for Storyboard Room video generation.
--
-- Higgsfield generation POSTs have no documented idempotency key. Exact
-- provider handles, polling leases, callback dedupe and archive deadlines
-- therefore belong in durable state before a worker is enabled.

BEGIN;

ALTER TABLE storyboard_ai_video_jobs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submit_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_terminal_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_request_id VARCHAR(500),
  ADD COLUMN IF NOT EXISTS provider_status VARCHAR(24),
  ADD COLUMN IF NOT EXISTS provider_status_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_cancel_url TEXT,
  ADD COLUMN IF NOT EXISTS provider_correlation_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS callback_token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS callback_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS callback_token_revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_poll_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS poll_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_poll_error TEXT,
  ADD COLUMN IF NOT EXISTS reconcile_lease_owner VARCHAR(255),
  ADD COLUMN IF NOT EXISTS reconcile_lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_status VARCHAR(24) NOT NULL DEFAULT 'not_ready',
  ADD COLUMN IF NOT EXISTS archive_next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_error TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archive_lease_owner VARCHAR(255),
  ADD COLUMN IF NOT EXISTS archive_lease_expires_at TIMESTAMPTZ;

UPDATE storyboard_ai_video_jobs
   SET updated_at = COALESCE(completed_at, created_at, NOW())
 WHERE updated_at IS NULL;

-- Preserve a valid provider UUID even when the historical lifecycle URL is
-- missing. Acceptance is then known, while polling remains blocked.
UPDATE storyboard_ai_video_jobs
   SET provider_request_id = LOWER(fal_request_id)
 WHERE provider = 'higgsfield'
   AND provider_request_id IS NULL
   AND fal_request_id ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

DO $casefolded_provider_ids$
BEGIN
  IF EXISTS (
    SELECT LOWER(provider_request_id)
      FROM storyboard_ai_video_jobs
     WHERE provider = 'higgsfield'
       AND provider_request_id ~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     GROUP BY LOWER(provider_request_id)
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'case-folded duplicate Higgsfield request ids require reconciliation';
  END IF;
END
$casefolded_provider_ids$;

UPDATE storyboard_ai_video_jobs
   SET provider_request_id = LOWER(provider_request_id)
 WHERE provider = 'higgsfield'
   AND provider_request_id ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   AND provider_request_id <> LOWER(provider_request_id);

-- Only bind historical status URLs that meet the verified host/path/request
-- contract. Invalid or foreign-looking values are deliberately not copied.
UPDATE storyboard_ai_video_jobs
   SET provider_status_url = response_url
 WHERE provider = 'higgsfield'
   AND provider_request_id IS NOT NULL
   AND provider_status_url IS NULL
   AND LOWER(COALESCE(response_url, '')) =
       'https://api.higgsfield.ai/requests/'
       || LOWER(provider_request_id) || '/status';

UPDATE storyboard_ai_video_jobs
   SET provider_status = CASE
         WHEN status = 'queued' THEN 'queued'
         WHEN status IN ('running', 'processing') THEN 'in_progress'
         WHEN status = 'completed' THEN 'completed'
         WHEN status = 'nsfw' THEN 'nsfw'
         WHEN status IN ('canceled', 'cancelled') THEN 'canceled'
         ELSE provider_status
       END,
       provider_terminal_at = CASE
         WHEN status IN ('completed', 'nsfw', 'canceled', 'cancelled')
         THEN COALESCE(completed_at, created_at)
         ELSE provider_terminal_at
       END
 WHERE provider = 'higgsfield'
   AND provider_request_id IS NOT NULL;

-- An old active row with no verifiable provider handle must never cause a
-- second paid POST. Keep it visible for operator reconciliation instead.
UPDATE storyboard_ai_video_jobs
   SET status = CASE
         WHEN provider_request_id IS NULL
         THEN 'submission_unknown'
         ELSE 'accepted_contract_unknown'
       END,
       updated_at = NOW()
 WHERE provider = 'higgsfield'
   AND status IN ('submitting', 'queued', 'running', 'processing')
   AND (provider_request_id IS NULL OR provider_status_url IS NULL);

UPDATE storyboard_ai_video_jobs
   SET next_poll_at = NOW()
 WHERE provider = 'higgsfield'
   AND provider_request_id IS NOT NULL
   AND provider_status_url IS NOT NULL
   AND provider_status IN ('queued', 'in_progress')
   AND status IN ('queued', 'running', 'processing')
   AND next_poll_at IS NULL;

UPDATE storyboard_ai_video_jobs
   SET archive_status = CASE
         WHEN output_b2_key IS NOT NULL THEN 'archived'
         WHEN archive_status IS NOT NULL
          AND archive_status <> 'not_ready'
         THEN archive_status
         WHEN status = 'completed' THEN 'pending'
         ELSE 'not_ready'
       END,
       archived_at = CASE
         WHEN output_b2_key IS NOT NULL
         THEN COALESCE(archived_at, completed_at, created_at)
         ELSE archived_at
       END,
       archive_next_attempt_at = CASE
         WHEN output_b2_key IS NOT NULL THEN NULL
         WHEN output_b2_key IS NULL AND status = 'completed'
         THEN COALESCE(archive_next_attempt_at, NOW())
         ELSE archive_next_attempt_at
       END,
       archive_deadline_at = CASE
         WHEN output_b2_key IS NOT NULL THEN NULL
         WHEN output_b2_key IS NULL AND status = 'completed'
         THEN COALESCE(
           archive_deadline_at,
           COALESCE(completed_at, created_at, NOW()) + INTERVAL '6 days'
         )
         ELSE archive_deadline_at
       END,
       archive_error = CASE
         WHEN output_b2_key IS NOT NULL THEN NULL
         ELSE archive_error
       END;

UPDATE storyboard_ai_video_jobs
   SET poll_attempts = COALESCE(poll_attempts, 0),
       archive_attempts = COALESCE(archive_attempts, 0),
       archive_status = COALESCE(
         archive_status,
         CASE
           WHEN output_b2_key IS NOT NULL THEN 'archived'
           WHEN status = 'completed' THEN 'pending'
           ELSE 'not_ready'
         END
       );

UPDATE storyboard_ai_video_jobs
   SET archive_status='retry_wait',
       archive_next_attempt_at=COALESCE(archive_next_attempt_at,NOW()),
       archive_lease_owner=NULL,
       archive_lease_expires_at=NULL
 WHERE archive_status='archiving'
   AND (archive_lease_owner IS NULL OR archive_lease_expires_at IS NULL);

UPDATE storyboard_ai_video_jobs
   SET archive_lease_owner=NULL,archive_lease_expires_at=NULL
 WHERE archive_status<>'archiving'
   AND (archive_lease_owner IS NOT NULL OR archive_lease_expires_at IS NOT NULL);

ALTER TABLE storyboard_ai_video_jobs
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN poll_attempts SET DEFAULT 0,
  ALTER COLUMN poll_attempts SET NOT NULL,
  ALTER COLUMN archive_attempts SET DEFAULT 0,
  ALTER COLUMN archive_attempts SET NOT NULL,
  ALTER COLUMN archive_status SET DEFAULT 'not_ready',
  ALTER COLUMN archive_status SET NOT NULL;

ALTER TABLE storyboard_ai_video_jobs
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_provider_status_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_poll_attempts_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_lease_pair_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_callback_hash_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_callback_expiry_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_next_poll_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_terminal_time_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_archive_status_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_archive_attempts_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_archive_lease_pair_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_archive_lease_state_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_archived_output_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_jobs_higgsfield_uuid_check;

ALTER TABLE storyboard_ai_video_jobs
  ADD CONSTRAINT storyboard_ai_video_jobs_provider_status_check
    CHECK (
      provider_status IS NULL OR provider_status IN (
        'queued', 'in_progress', 'completed', 'failed', 'nsfw', 'canceled'
      )
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_poll_attempts_check
    CHECK (poll_attempts >= 0),
  ADD CONSTRAINT storyboard_ai_video_jobs_lease_pair_check
    CHECK (
      (reconcile_lease_owner IS NULL) =
      (reconcile_lease_expires_at IS NULL)
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_callback_hash_check
    CHECK (
      callback_token_hash IS NULL
      OR callback_token_hash ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_callback_expiry_check
    CHECK (
      callback_token_hash IS NULL OR callback_token_expires_at IS NOT NULL
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_next_poll_check
    CHECK (
      next_poll_at IS NULL
      OR (
        provider_request_id IS NOT NULL
        AND provider_status_url IS NOT NULL
        AND provider_status IN ('queued', 'in_progress')
      )
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_terminal_time_check
    CHECK (
      provider_terminal_at IS NULL
      OR provider_status IN ('completed', 'failed', 'nsfw', 'canceled')
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_archive_status_check
    CHECK (
      archive_status IN (
        'not_ready', 'pending', 'archiving', 'retry_wait', 'archived', 'failed'
      )
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_archive_attempts_check
    CHECK (archive_attempts >= 0),
  ADD CONSTRAINT storyboard_ai_video_jobs_archive_lease_pair_check
    CHECK (
      (archive_lease_owner IS NULL) =
      (archive_lease_expires_at IS NULL)
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_archive_lease_state_check
    CHECK (
      (archive_status = 'archiving') = (archive_lease_owner IS NOT NULL)
    ),
  ADD CONSTRAINT storyboard_ai_video_jobs_archived_output_check
    -- Migrations run before the new Render instance is deployed. The previous
    -- server can still write output_b2_key without archive_status during that
    -- window, so enforce the safe direction until a later two-phase tightening.
    CHECK (archive_status <> 'archived' OR output_b2_key IS NOT NULL),
  ADD CONSTRAINT storyboard_ai_video_jobs_higgsfield_uuid_check
    CHECK (
      provider <> 'higgsfield'
      OR provider_request_id IS NULL
      OR provider_request_id ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    );

DO $migration$
BEGIN
  IF EXISTS (
    SELECT provider_request_id
      FROM storyboard_ai_video_jobs
     WHERE provider = 'higgsfield' AND provider_request_id IS NOT NULL
     GROUP BY provider_request_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'duplicate Higgsfield provider_request_id values require reconciliation';
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_video_jobs_higgsfield_request_uidx
  ON storyboard_ai_video_jobs (provider_request_id)
  WHERE provider = 'higgsfield' AND provider_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_video_jobs_callback_token_uidx
  ON storyboard_ai_video_jobs (callback_token_hash)
  WHERE callback_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS storyboard_ai_video_jobs_provider_poll_idx
  ON storyboard_ai_video_jobs (next_poll_at, id)
  WHERE provider = 'higgsfield'
    AND provider_status IN ('queued', 'in_progress')
    AND status IN ('queued', 'running', 'processing');

CREATE INDEX IF NOT EXISTS storyboard_ai_video_jobs_reconcile_idx
  ON storyboard_ai_video_jobs (updated_at, id)
  WHERE status IN ('submission_unknown', 'accepted_contract_unknown');

CREATE INDEX IF NOT EXISTS storyboard_ai_video_jobs_archive_due_idx
  ON storyboard_ai_video_jobs (archive_next_attempt_at, id)
  WHERE archive_status IN ('pending', 'retry_wait');

CREATE INDEX IF NOT EXISTS storyboard_ai_video_jobs_archive_deadline_idx
  ON storyboard_ai_video_jobs (archive_deadline_at, id)
  WHERE archive_status <> 'archived' AND archive_deadline_at IS NOT NULL;

-- Financial side effects use an outbox because neither a wallet mutation nor
-- a Stripe meter call may run inside the provider terminal-state transaction.
-- Stable refs make wallet operations idempotent. Meter delivery has a bounded
-- ambiguity window: after twenty hours it is parked for manual reconciliation
-- rather than resent outside Stripe's documented identifier-dedupe window.
CREATE TABLE IF NOT EXISTS storyboard_ai_video_billing_settlements (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL
    REFERENCES storyboard_ai_video_jobs(id) ON DELETE RESTRICT,
  kind VARCHAR(24) NOT NULL,
  user_id VARCHAR NOT NULL,
  model VARCHAR NOT NULL,
  amount_usd NUMERIC NOT NULL,
  billing_mode VARCHAR(24) NOT NULL,
  external_ref VARCHAR(255) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  delivery_deadline_at TIMESTAMPTZ,
  lease_owner VARCHAR(255),
  lease_expires_at TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repair a table that may have been created by a rolling-deploy inline schema
-- guard before this migration acquired the exclusive migration lock.
ALTER TABLE storyboard_ai_video_billing_settlements
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS kind VARCHAR(24),
  ADD COLUMN IF NOT EXISTS user_id VARCHAR,
  ADD COLUMN IF NOT EXISTS model VARCHAR,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS billing_mode VARCHAR(24),
  ADD COLUMN IF NOT EXISTS external_ref VARCHAR(255),
  ADD COLUMN IF NOT EXISTS status VARCHAR(24) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_owner VARCHAR(255),
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE storyboard_ai_video_billing_settlements
   SET created_at=COALESCE(created_at,NOW()),
       status=COALESCE(status,'pending'),
       attempts=COALESCE(attempts,0),
       updated_at=COALESCE(updated_at,created_at,NOW()),
       next_attempt_at=CASE
         WHEN COALESCE(status,'pending') IN ('pending','retry_wait')
         THEN COALESCE(next_attempt_at,NOW())
         ELSE next_attempt_at
       END,
       delivery_deadline_at=CASE
         WHEN kind='meter'
         THEN COALESCE(delivery_deadline_at,created_at+INTERVAL '20 hours')
         ELSE NULL
       END;

UPDATE storyboard_ai_video_billing_settlements
   SET status='retry_wait',
       next_attempt_at=COALESCE(next_attempt_at,NOW()),
       lease_owner=NULL,
       lease_expires_at=NULL
 WHERE status='delivering'
   AND (lease_owner IS NULL OR lease_expires_at IS NULL);

UPDATE storyboard_ai_video_billing_settlements
   SET lease_owner=NULL,lease_expires_at=NULL
 WHERE status<>'delivering'
   AND (lease_owner IS NOT NULL OR lease_expires_at IS NOT NULL);

UPDATE storyboard_ai_video_billing_settlements
   SET completed_at=COALESCE(completed_at,updated_at,NOW())
 WHERE status='completed' AND completed_at IS NULL;

UPDATE storyboard_ai_video_billing_settlements
   SET next_attempt_at=NULL
 WHERE status IN ('completed','permanent_failed','delivery_unknown');

DO $billing_required_values$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storyboard_ai_video_billing_settlements
     WHERE job_id IS NULL OR kind IS NULL OR user_id IS NULL OR model IS NULL
        OR amount_usd IS NULL OR billing_mode IS NULL OR external_ref IS NULL
  ) THEN
    RAISE EXCEPTION
      'storyboard video billing rows with missing financial identity require reconciliation';
  END IF;
END
$billing_required_values$;

ALTER TABLE storyboard_ai_video_billing_settlements
  ALTER COLUMN job_id SET NOT NULL,
  ALTER COLUMN kind SET NOT NULL,
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN model SET NOT NULL,
  ALTER COLUMN amount_usd SET NOT NULL,
  ALTER COLUMN billing_mode SET NOT NULL,
  ALTER COLUMN external_ref SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN attempts SET DEFAULT 0,
  ALTER COLUMN attempts SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE storyboard_ai_video_billing_settlements
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_kind_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_mode_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_amount_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_status_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_attempts_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_lease_pair_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_lease_state_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_deadline_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_next_attempt_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_completed_at_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_external_ref_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_billing_settlements_job_id_fkey;

ALTER TABLE storyboard_ai_video_billing_settlements
  ADD CONSTRAINT storyboard_ai_video_billing_settlements_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES storyboard_ai_video_jobs(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT storyboard_ai_video_billing_kind_check
    CHECK (kind IN ('credit_debit','credit_refund','meter')),
  ADD CONSTRAINT storyboard_ai_video_billing_mode_check
    CHECK (
      (kind IN ('credit_debit','credit_refund') AND billing_mode='credits')
      OR (kind='meter' AND billing_mode='metered')
    ),
  ADD CONSTRAINT storyboard_ai_video_billing_amount_check
    CHECK (amount_usd > 0),
  ADD CONSTRAINT storyboard_ai_video_billing_status_check
    CHECK (status IN (
      'pending','delivering','retry_wait','completed',
      'permanent_failed','delivery_unknown'
    )),
  ADD CONSTRAINT storyboard_ai_video_billing_attempts_check
    CHECK (attempts >= 0),
  ADD CONSTRAINT storyboard_ai_video_billing_lease_pair_check
    CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL)),
  ADD CONSTRAINT storyboard_ai_video_billing_lease_state_check
    CHECK ((status='delivering') = (lease_owner IS NOT NULL)),
  ADD CONSTRAINT storyboard_ai_video_billing_deadline_check
    CHECK (
      (kind='meter' AND delivery_deadline_at IS NOT NULL)
      OR (kind<>'meter' AND delivery_deadline_at IS NULL)
    ),
  ADD CONSTRAINT storyboard_ai_video_billing_next_attempt_check
    CHECK (
      (status IN ('pending','retry_wait','delivering')) =
      (next_attempt_at IS NOT NULL)
    ),
  ADD CONSTRAINT storyboard_ai_video_billing_completed_at_check
    CHECK ((status='completed') = (completed_at IS NOT NULL)),
  ADD CONSTRAINT storyboard_ai_video_billing_external_ref_check
    CHECK (
      external_ref=CASE kind
        WHEN 'credit_debit' THEN 'job:'||job_id::text
        WHEN 'credit_refund' THEN 'job-refund:'||job_id::text
        WHEN 'meter' THEN 'storyboard-video-meter:'||job_id::text
      END
    );

DO $billing_job_kind_dedupe$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'storyboard_ai_video_billing_settlements'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (job_id, kind)'
  ) AND to_regclass(
    'storyboard_ai_video_billing_job_kind_uidx'
  ) IS NULL THEN
    EXECUTE
      'CREATE UNIQUE INDEX storyboard_ai_video_billing_job_kind_uidx '
      || 'ON storyboard_ai_video_billing_settlements (job_id, kind)';
  END IF;
END
$billing_job_kind_dedupe$;

DO $billing_external_ref_dedupe$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'storyboard_ai_video_billing_settlements'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (external_ref)'
  ) AND to_regclass(
    'storyboard_ai_video_billing_external_ref_uidx'
  ) IS NULL THEN
    EXECUTE
      'CREATE UNIQUE INDEX storyboard_ai_video_billing_external_ref_uidx '
      || 'ON storyboard_ai_video_billing_settlements (external_ref)';
  END IF;
END
$billing_external_ref_dedupe$;

CREATE INDEX IF NOT EXISTS storyboard_ai_video_billing_due_idx
  ON storyboard_ai_video_billing_settlements (next_attempt_at,created_at)
  WHERE status IN ('pending','retry_wait','delivering');

CREATE OR REPLACE FUNCTION prevent_storyboard_video_billing_ref_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.external_ref IS DISTINCT FROM OLD.external_ref
     OR NEW.job_id IS DISTINCT FROM OLD.job_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.model IS DISTINCT FROM OLD.model
     OR NEW.amount_usd IS DISTINCT FROM OLD.amount_usd
     OR NEW.billing_mode IS DISTINCT FROM OLD.billing_mode THEN
    RAISE EXCEPTION 'storyboard video billing identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storyboard_ai_video_billing_identity_immutable
  ON storyboard_ai_video_billing_settlements;
CREATE TRIGGER storyboard_ai_video_billing_identity_immutable
BEFORE UPDATE ON storyboard_ai_video_billing_settlements
FOR EACH ROW EXECUTE FUNCTION prevent_storyboard_video_billing_ref_change();

CREATE TABLE IF NOT EXISTS storyboard_ai_video_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL
    REFERENCES storyboard_ai_video_jobs(id) ON DELETE CASCADE,
  provider VARCHAR(60) NOT NULL,
  provider_request_id VARCHAR(500) NOT NULL,
  provider_status VARCHAR(24) NOT NULL,
  source VARCHAR(12) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_fingerprint VARCHAR(64) NOT NULL,
  provider_correlation_id VARCHAR(255),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT,
  CONSTRAINT storyboard_ai_video_provider_events_status_check
    CHECK (
      (source = 'webhook' AND provider_status IN ('completed', 'failed', 'nsfw'))
      OR
      (source = 'poll' AND provider_status IN (
        'completed', 'failed', 'nsfw', 'canceled'
      ))
    ),
  CONSTRAINT storyboard_ai_video_provider_events_fingerprint_check
    CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$')
);

UPDATE storyboard_ai_video_provider_events
   SET received_at = COALESCE(received_at, NOW());

ALTER TABLE storyboard_ai_video_provider_events
  ALTER COLUMN received_at SET DEFAULT NOW(),
  ALTER COLUMN received_at SET NOT NULL;

ALTER TABLE storyboard_ai_video_provider_events
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_provider_events_status_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_video_provider_events_fingerprint_check;

ALTER TABLE storyboard_ai_video_provider_events
  ADD CONSTRAINT storyboard_ai_video_provider_events_status_check
    CHECK (
      (source = 'webhook' AND provider_status IN ('completed', 'failed', 'nsfw'))
      OR
      (source = 'poll' AND provider_status IN (
        'completed', 'failed', 'nsfw', 'canceled'
      ))
    ),
  ADD CONSTRAINT storyboard_ai_video_provider_events_fingerprint_check
    CHECK (payload_fingerprint ~ '^[0-9a-f]{64}$');

DO $event_dedupe$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'storyboard_ai_video_provider_events'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) =
         'UNIQUE (provider, provider_request_id, provider_status)'
  ) AND to_regclass(
    'storyboard_ai_video_provider_events_dedupe_uidx'
  ) IS NULL THEN
    EXECUTE
      'CREATE UNIQUE INDEX storyboard_ai_video_provider_events_dedupe_uidx '
      || 'ON storyboard_ai_video_provider_events '
      || '(provider, provider_request_id, provider_status)';
  END IF;
END
$event_dedupe$;

CREATE INDEX IF NOT EXISTS storyboard_ai_video_provider_events_job_idx
  ON storyboard_ai_video_provider_events (job_id, received_at DESC);

COMMIT;
