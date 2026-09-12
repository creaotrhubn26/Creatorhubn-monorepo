-- 0532_leadgrid_discovery_observation_snapshots.sql
--
-- Expand phase: add an immutable, run-local provider observation without a
-- long ACCESS EXCLUSIVE lock. The insert trigger protects writes from the old
-- backend during a rolling deploy. Existing rows are backfilled and contracted
-- in 0534 after this short schema change has committed.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_discovery_run_candidates
  ADD COLUMN IF NOT EXISTS observation_snapshot JSONB;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_run_candidates'::regclass
       AND conname = 'leadgrid_discovery_run_candidates_snapshot_object_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_run_candidates
      ADD CONSTRAINT leadgrid_discovery_run_candidates_snapshot_object_check
      CHECK (
        observation_snapshot IS NULL
        OR (
          jsonb_typeof(observation_snapshot) = 'object'
          AND observation_snapshot ?& ARRAY[
            'schema_version', 'snapshot_origin', 'observed_at', 'captured_at',
            'name', 'address', 'city', 'postal_code', 'country_code',
            'latitude', 'longitude', 'website_url', 'phone', 'email',
            'organization_number', 'raw_data', 'enrichment_data', 'provenance'
          ]
          AND observation_snapshot->>'schema_version' = '1'
          AND observation_snapshot->>'snapshot_origin' IN (
            'provider_observation',
            'rolling_deploy_canonical_fallback',
            'legacy_backfill_current_canonical'
          )
          AND jsonb_typeof(observation_snapshot->'name') = 'string'
          AND jsonb_typeof(observation_snapshot->'raw_data') = 'object'
          AND jsonb_typeof(observation_snapshot->'enrichment_data') = 'object'
          AND jsonb_typeof(observation_snapshot->'provenance') = 'array'
        )
      ) NOT VALID;
  END IF;
END
$constraint$;

CREATE OR REPLACE FUNCTION leadgrid_fill_discovery_observation_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.observation_snapshot IS NULL
     OR NEW.observation_snapshot = '{}'::jsonb THEN
    SELECT jsonb_build_object(
             'schema_version', 1,
             'snapshot_origin', 'rolling_deploy_canonical_fallback',
             'observed_at', COALESCE(NEW.created_at, NOW()),
             'captured_at', NOW(),
             'name', candidate.name,
             'address', candidate.address,
             'city', candidate.city,
             'postal_code', candidate.postal_code,
             'country_code', candidate.country_code,
             'latitude', candidate.latitude,
             'longitude', candidate.longitude,
             'website_url', candidate.website_url,
             'phone', candidate.phone,
             'email', candidate.email,
             'organization_number', candidate.organization_number,
             'raw_data', candidate.raw_data,
             'enrichment_data', candidate.enrichment_data,
             'provenance', candidate.provenance
           )
      INTO NEW.observation_snapshot
      FROM leadgrid_discovery_candidates candidate
     WHERE candidate.id = NEW.candidate_id
       AND candidate.organization_id = NEW.organization_id
       AND candidate.project_id = NEW.project_id;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS fill_leadgrid_discovery_observation_snapshot
  ON leadgrid_discovery_run_candidates;
CREATE TRIGGER fill_leadgrid_discovery_observation_snapshot
  BEFORE INSERT ON leadgrid_discovery_run_candidates
  FOR EACH ROW
  EXECUTE FUNCTION leadgrid_fill_discovery_observation_snapshot();

CREATE OR REPLACE FUNCTION leadgrid_guard_discovery_observation_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  -- NULL / {} is the only legacy state that the contract backfill may fill.
  IF OLD.observation_snapshot IS NOT NULL
     AND OLD.observation_snapshot <> '{}'::jsonb
     AND NEW.observation_snapshot IS DISTINCT FROM OLD.observation_snapshot THEN
    RAISE EXCEPTION
      'leadgrid_discovery_run_candidates.observation_snapshot is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS guard_leadgrid_discovery_observation_snapshot
  ON leadgrid_discovery_run_candidates;
CREATE TRIGGER guard_leadgrid_discovery_observation_snapshot
  BEFORE UPDATE OF observation_snapshot
  ON leadgrid_discovery_run_candidates
  FOR EACH ROW
  EXECUTE FUNCTION leadgrid_guard_discovery_observation_snapshot();

COMMENT ON COLUMN leadgrid_discovery_run_candidates.observation_snapshot IS
  'Immutable run-local provider observation. Historical review, promotion and intelligence read this instead of the mutable canonical candidate.';

COMMIT;
