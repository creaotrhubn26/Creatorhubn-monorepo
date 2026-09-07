-- 0556_leadgrid_discovery_place_confirmation_retention.sql
--
-- Index-backed retention for both consumed and unconsumed Google Place-ID
-- attestations after their short validation window has expired.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_place_confirmations_retention
  ON leadgrid_discovery_place_confirmations (
    expires_at,
    organization_id,
    project_id,
    run_id,
    candidate_id,
    place_id,
    requested_by
  );

COMMENT ON INDEX idx_leadgrid_discovery_place_confirmations_retention IS
  'Supports bounded daily deletion of all expired Place-ID attestations, including consumed rows.';

COMMIT;
