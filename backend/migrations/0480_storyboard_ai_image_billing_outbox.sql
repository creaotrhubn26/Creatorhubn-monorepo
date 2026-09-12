-- migration-role: creatorhub_migrator
-- Durable financial intents for Storyboard Room image generations.
--
-- No historical usage row is backfilled. Only reservations explicitly written
-- with billing_intent_version=1 participate in automatic recovery. A stale
-- processing operation has crossed the provider boundary and is never
-- resubmitted or refunded automatically.

BEGIN;

ALTER TABLE storyboard_ai_image_usage
  ADD COLUMN IF NOT EXISTS billing_intent_version SMALLINT;

ALTER TABLE storyboard_ai_image_usage
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_usage_billing_intent_check;

ALTER TABLE storyboard_ai_image_usage
  ADD CONSTRAINT storyboard_ai_image_usage_billing_intent_check
    CHECK (
      billing_intent_version IS NULL
      OR (
        billing_intent_version = 1
        AND billing_mode IN ('free_whitelist','credits','metered')
        AND (
          (billing_mode='free_whitelist' AND billed_usd=0)
          OR (billing_mode IN ('credits','metered') AND billed_usd>0)
        )
      )
    );

CREATE TABLE IF NOT EXISTS storyboard_ai_image_billing_settlements (
  id UUID PRIMARY KEY,
  usage_id UUID NOT NULL,
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

-- Repair a table created by a rolling application instance before this
-- migration. Identity columns are never synthesized: ambiguous rows stop the
-- migration and require explicit reconciliation.
ALTER TABLE storyboard_ai_image_billing_settlements
  ADD COLUMN IF NOT EXISTS id UUID,
  ADD COLUMN IF NOT EXISTS usage_id UUID,
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

UPDATE storyboard_ai_image_billing_settlements
   SET created_at=COALESCE(created_at,NOW()),
       status=COALESCE(status,'pending'),
       attempts=COALESCE(attempts,0),
       updated_at=COALESCE(updated_at,created_at,NOW());

UPDATE storyboard_ai_image_billing_settlements
   SET delivery_deadline_at=CASE
         WHEN kind='meter' THEN created_at+INTERVAL '20 hours'
         ELSE NULL
       END;

UPDATE storyboard_ai_image_billing_settlements
   SET status='retry_wait',
       next_attempt_at=COALESCE(next_attempt_at,NOW()),
       lease_owner=NULL,
       lease_expires_at=NULL
 WHERE status='delivering'
   AND (
     lease_owner IS NULL OR lease_expires_at IS NULL
     OR (kind='meter' AND lease_expires_at>delivery_deadline_at)
   );

UPDATE storyboard_ai_image_billing_settlements
   SET lease_owner=NULL,lease_expires_at=NULL
 WHERE status<>'delivering'
   AND (lease_owner IS NOT NULL OR lease_expires_at IS NOT NULL);

UPDATE storyboard_ai_image_billing_settlements
   SET status='permanent_failed',
       next_attempt_at=NULL,
       lease_owner=NULL,
       lease_expires_at=NULL,
       last_error=COALESCE(last_error,'invalid_credit_delivery_unknown_state')
 WHERE status='delivery_unknown' AND kind<>'meter';

UPDATE storyboard_ai_image_billing_settlements
   SET next_attempt_at=COALESCE(next_attempt_at,NOW())
 WHERE status IN ('pending','retry_wait','delivering');

UPDATE storyboard_ai_image_billing_settlements
   SET next_attempt_at=NULL
 WHERE status IN ('completed','permanent_failed','delivery_unknown');

UPDATE storyboard_ai_image_billing_settlements
   SET completed_at=COALESCE(completed_at,updated_at,NOW())
 WHERE status='completed' AND completed_at IS NULL;

UPDATE storyboard_ai_image_billing_settlements
   SET completed_at=NULL
 WHERE status<>'completed' AND completed_at IS NOT NULL;

DO $image_billing_required_values$
BEGIN
  IF EXISTS (
    SELECT 1 FROM storyboard_ai_image_billing_settlements
     WHERE id IS NULL OR usage_id IS NULL OR kind IS NULL OR user_id IS NULL
        OR model IS NULL OR amount_usd IS NULL OR billing_mode IS NULL
        OR external_ref IS NULL OR status IS NULL OR attempts IS NULL
        OR created_at IS NULL OR updated_at IS NULL
  ) THEN
    RAISE EXCEPTION
      'storyboard image billing rows with missing financial identity require reconciliation';
  END IF;
END
$image_billing_required_values$;

ALTER TABLE storyboard_ai_image_billing_settlements
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN usage_id SET NOT NULL,
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

DO $image_billing_primary_key$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='storyboard_ai_image_billing_settlements'::regclass
       AND contype='p'
  ) THEN
    ALTER TABLE storyboard_ai_image_billing_settlements
      ADD CONSTRAINT storyboard_ai_image_billing_settlements_pkey
      PRIMARY KEY (id);
  END IF;
END
$image_billing_primary_key$;

-- Remove every rolling-schema FK on usage_id before restoring the exact
-- RESTRICT contract. The generated name is not stable across weak fixtures.
DO $image_billing_drop_usage_fks$
DECLARE
  constraint_row RECORD;
  usage_attnum SMALLINT;
BEGIN
  SELECT attnum INTO usage_attnum
    FROM pg_attribute
   WHERE attrelid='storyboard_ai_image_billing_settlements'::regclass
     AND attname='usage_id' AND NOT attisdropped;
  FOR constraint_row IN
    SELECT conname FROM pg_constraint
     WHERE conrelid='storyboard_ai_image_billing_settlements'::regclass
       AND contype='f' AND conkey=ARRAY[usage_attnum]::SMALLINT[]
  LOOP
    EXECUTE format(
      'ALTER TABLE storyboard_ai_image_billing_settlements DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END
$image_billing_drop_usage_fks$;

ALTER TABLE storyboard_ai_image_billing_settlements
  ADD CONSTRAINT storyboard_ai_image_billing_settlements_usage_id_fkey
    FOREIGN KEY (usage_id) REFERENCES storyboard_ai_image_usage(id)
    ON DELETE RESTRICT;

ALTER TABLE storyboard_ai_image_billing_settlements
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_kind_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_mode_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_amount_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_status_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_attempts_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_lease_pair_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_lease_state_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_deadline_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_lease_deadline_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_next_attempt_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_completed_at_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_delivery_unknown_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_billing_external_ref_check;

ALTER TABLE storyboard_ai_image_billing_settlements
  ADD CONSTRAINT storyboard_ai_image_billing_kind_check
    CHECK (kind IN ('credit_debit','credit_refund','meter')),
  ADD CONSTRAINT storyboard_ai_image_billing_mode_check
    CHECK (
      (kind IN ('credit_debit','credit_refund') AND billing_mode='credits')
      OR (kind='meter' AND billing_mode='metered')
    ),
  ADD CONSTRAINT storyboard_ai_image_billing_amount_check
    CHECK (amount_usd>0 AND amount_usd<=100000),
  ADD CONSTRAINT storyboard_ai_image_billing_status_check
    CHECK (status IN (
      'pending','delivering','retry_wait','completed',
      'permanent_failed','delivery_unknown'
    )),
  ADD CONSTRAINT storyboard_ai_image_billing_attempts_check
    CHECK (attempts>=0),
  ADD CONSTRAINT storyboard_ai_image_billing_lease_pair_check
    CHECK ((lease_owner IS NULL)=(lease_expires_at IS NULL)),
  ADD CONSTRAINT storyboard_ai_image_billing_lease_state_check
    CHECK ((status='delivering')=(lease_owner IS NOT NULL)),
  ADD CONSTRAINT storyboard_ai_image_billing_deadline_check
    CHECK (
      (kind='meter'
        AND delivery_deadline_at=created_at+INTERVAL '20 hours')
      OR (kind<>'meter' AND delivery_deadline_at IS NULL)
    ),
  ADD CONSTRAINT storyboard_ai_image_billing_lease_deadline_check
    CHECK (
      kind<>'meter' OR lease_expires_at IS NULL
      OR lease_expires_at<=delivery_deadline_at
    ),
  ADD CONSTRAINT storyboard_ai_image_billing_next_attempt_check
    CHECK (
      (status IN ('pending','retry_wait','delivering'))=
      (next_attempt_at IS NOT NULL)
    ),
  ADD CONSTRAINT storyboard_ai_image_billing_completed_at_check
    CHECK ((status='completed')=(completed_at IS NOT NULL)),
  ADD CONSTRAINT storyboard_ai_image_billing_delivery_unknown_check
    CHECK (status<>'delivery_unknown' OR kind='meter'),
  ADD CONSTRAINT storyboard_ai_image_billing_external_ref_check
    CHECK (
      external_ref=CASE kind
        WHEN 'credit_debit' THEN 'storyboard-image:'||usage_id::text
        WHEN 'credit_refund' THEN 'storyboard-image-refund:'||usage_id::text
        WHEN 'meter' THEN 'storyboard-image-meter:'||usage_id::text
      END
    );

-- Inline UNIQUE constraints created by an earlier runtime already own backing
-- indexes. Do not add a second named index merely because its name differs.
DO $image_billing_usage_kind_dedupe$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='storyboard_ai_image_billing_settlements'::regclass
       AND contype='u'
       AND pg_get_constraintdef(oid)='UNIQUE (usage_id, kind)'
  ) AND to_regclass('storyboard_ai_image_billing_usage_kind_uq') IS NULL THEN
    CREATE UNIQUE INDEX storyboard_ai_image_billing_usage_kind_uq
      ON storyboard_ai_image_billing_settlements (usage_id,kind);
  END IF;
END
$image_billing_usage_kind_dedupe$;

DO $image_billing_external_ref_dedupe$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid='storyboard_ai_image_billing_settlements'::regclass
       AND contype='u'
       AND pg_get_constraintdef(oid)='UNIQUE (external_ref)'
  ) AND to_regclass('storyboard_ai_image_billing_external_ref_uq') IS NULL THEN
    CREATE UNIQUE INDEX storyboard_ai_image_billing_external_ref_uq
      ON storyboard_ai_image_billing_settlements (external_ref);
  END IF;
END
$image_billing_external_ref_dedupe$;

CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_billing_charge_intent_uq
  ON storyboard_ai_image_billing_settlements (usage_id)
  WHERE kind IN ('credit_debit','meter');

CREATE INDEX IF NOT EXISTS storyboard_ai_image_billing_due_idx
  ON storyboard_ai_image_billing_settlements (next_attempt_at,created_at,id)
  WHERE status IN ('pending','retry_wait','delivering');

CREATE INDEX IF NOT EXISTS storyboard_ai_image_billing_deadline_idx
  ON storyboard_ai_image_billing_settlements (delivery_deadline_at,id)
  WHERE kind='meter'
    AND status IN ('pending','retry_wait','delivering');

DROP INDEX IF EXISTS storyboard_ai_image_usage_recovery_idx;
CREATE INDEX storyboard_ai_image_usage_recovery_idx
  ON storyboard_ai_image_usage (created_at,id)
  WHERE status='reserved' AND billing_intent_version=1;

CREATE OR REPLACE FUNCTION prevent_storyboard_image_billing_identity_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.usage_id IS DISTINCT FROM OLD.usage_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.model IS DISTINCT FROM OLD.model
     OR NEW.amount_usd IS DISTINCT FROM OLD.amount_usd
     OR NEW.billing_mode IS DISTINCT FROM OLD.billing_mode
     OR NEW.external_ref IS DISTINCT FROM OLD.external_ref
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.delivery_deadline_at IS DISTINCT FROM OLD.delivery_deadline_at THEN
    RAISE EXCEPTION 'storyboard image billing identity is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storyboard_ai_image_billing_identity_immutable
  ON storyboard_ai_image_billing_settlements;
CREATE TRIGGER storyboard_ai_image_billing_identity_immutable
BEFORE UPDATE ON storyboard_ai_image_billing_settlements
FOR EACH ROW EXECUTE FUNCTION prevent_storyboard_image_billing_identity_change();

CREATE OR REPLACE FUNCTION prevent_storyboard_image_billing_intent_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.billing_intent_version IS DISTINCT FROM OLD.billing_intent_version
     OR (
       OLD.billing_intent_version IS NOT NULL
       AND (
         NEW.project_id IS DISTINCT FROM OLD.project_id
         OR NEW.storyboard_id IS DISTINCT FROM OLD.storyboard_id
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.model IS DISTINCT FROM OLD.model
         OR NEW.quality IS DISTINCT FROM OLD.quality
         OR NEW.billed_usd IS DISTINCT FROM OLD.billed_usd
         OR NEW.billing_mode IS DISTINCT FROM OLD.billing_mode
         OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
       )
     ) THEN
    RAISE EXCEPTION 'storyboard image billing intent is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS storyboard_ai_image_billing_intent_immutable
  ON storyboard_ai_image_usage;
CREATE TRIGGER storyboard_ai_image_billing_intent_immutable
BEFORE UPDATE ON storyboard_ai_image_usage
FOR EACH ROW EXECUTE FUNCTION prevent_storyboard_image_billing_intent_change();

COMMIT;
