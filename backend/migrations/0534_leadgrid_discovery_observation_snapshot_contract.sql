-- 0534_leadgrid_discovery_observation_snapshot_contract.sql
--
-- Contract phase for 0532. Backfilled rows are explicitly labelled as a
-- current-canonical fallback: they are useful for compatibility, but must not
-- masquerade as the original historical provider observation.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '300s';

-- A single UPDATE is operationally preferable for the normal bounded
-- Discovery volume. Refuse an unexpectedly large backfill instead of holding
-- a very large set of row locks; operations can then run a measured batch
-- backfill before retrying this idempotent migration.
DO $preflight$
DECLARE
  pending_backfill BIGINT;
BEGIN
  SELECT COUNT(*)
    INTO pending_backfill
    FROM leadgrid_discovery_run_candidates
   WHERE observation_snapshot IS NULL
      OR observation_snapshot = '{}'::jsonb;

  IF pending_backfill > 100000 THEN
    RAISE EXCEPTION
      'Discovery snapshot backfill has % rows; batch it before 0534',
      pending_backfill;
  END IF;
END
$preflight$;

UPDATE leadgrid_discovery_run_candidates occurrence
   SET observation_snapshot = jsonb_build_object(
         'schema_version', 1,
         'snapshot_origin', 'legacy_backfill_current_canonical',
         'observed_at', NULL,
         'captured_at', NOW(),
         'legacy_occurrence_created_at', occurrence.created_at,
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
  FROM leadgrid_discovery_candidates candidate
 WHERE candidate.id = occurrence.candidate_id
   AND candidate.organization_id = occurrence.organization_id
   AND candidate.project_id = occurrence.project_id
   AND (
     occurrence.observation_snapshot IS NULL
     OR occurrence.observation_snapshot = '{}'::jsonb
   );

ALTER TABLE leadgrid_discovery_run_candidates
  VALIDATE CONSTRAINT
    leadgrid_discovery_run_candidates_snapshot_object_check;

ALTER TABLE leadgrid_discovery_run_candidates
  DROP CONSTRAINT IF EXISTS
    leadgrid_discovery_run_candidates_snapshot_not_null_check;
ALTER TABLE leadgrid_discovery_run_candidates
  ADD CONSTRAINT leadgrid_discovery_run_candidates_snapshot_not_null_check
  CHECK (observation_snapshot IS NOT NULL) NOT VALID;
ALTER TABLE leadgrid_discovery_run_candidates
  VALIDATE CONSTRAINT
    leadgrid_discovery_run_candidates_snapshot_not_null_check;

-- PostgreSQL can reuse the validated CHECK proof, avoiding a second table
-- scan while ACCESS EXCLUSIVE is held for the metadata change.
ALTER TABLE leadgrid_discovery_run_candidates
  ALTER COLUMN observation_snapshot SET NOT NULL;

ALTER TABLE leadgrid_discovery_run_candidates
  DROP CONSTRAINT
    leadgrid_discovery_run_candidates_snapshot_not_null_check;

COMMIT;
