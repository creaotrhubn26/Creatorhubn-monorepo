-- Bound the temporary JSON-backed compatibility queue used by legacy
-- generative_ai_jobs. New Storyboard Room work uses the normalized billing
-- outbox; this index contains only explicit, unfinished legacy intents.
--
-- Some clean environments create generative_ai_jobs lazily from the workspace
-- route, so the migration must remain safe when that compatibility table is
-- absent. Production environments with the table receive the partial index.

DO $legacy_generative_ai_billing_due_index$
BEGIN
  IF to_regclass('public.generative_ai_jobs') IS NOT NULL THEN
    EXECUTE $index$
      CREATE INDEX IF NOT EXISTS
        generative_ai_jobs_legacy_billing_due_idx
      ON public.generative_ai_jobs (
        ((input #>> '{legacyBilling,status}')),
        ((input #>> '{legacyBilling,nextAttemptAt}')),
        ((input #>> '{legacyBilling,leaseExpiresAt}')),
        ((input #>> '{legacyBilling,deadlineAt}')),
        completed_at,
        id
      )
      WHERE status = 'completed'
        AND (input #>> '{legacyBilling,mode}') IN ('metered','credits')
        AND (input #>> '{legacyBilling,status}')
          IN ('pending','retry_wait','delivering')
    $index$;
  END IF;
END
$legacy_generative_ai_billing_due_index$;
