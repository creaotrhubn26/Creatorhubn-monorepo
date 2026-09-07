-- 0522_leadgrid_discovery_profile_targeting.sql
-- Queryable territory provenance and explicit Google Place-ID confirmation for
-- leads promoted from project-scoped Discovery profiles.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS discovery_territory_code VARCHAR(48),
  ADD COLUMN IF NOT EXISTS google_place_id_confirmed_at TIMESTAMPTZ;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.crm_customers'::regclass
       AND conname = 'crm_customers_discovery_territory_code_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_discovery_territory_code_check
      CHECK (
        discovery_territory_code IS NULL
        OR discovery_territory_code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.crm_customers'::regclass
       AND conname = 'crm_customers_google_place_confirmation_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_google_place_confirmation_check
      CHECK (
        google_place_id_confirmed_at IS NULL OR google_place_id IS NOT NULL
      ) NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE crm_customers
  VALIDATE CONSTRAINT crm_customers_discovery_territory_code_check;
ALTER TABLE crm_customers
  VALIDATE CONSTRAINT crm_customers_google_place_confirmation_check;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_project_discovery_territory
  ON crm_customers (organization_id, project_id, discovery_territory_code)
  WHERE discovery_territory_code IS NOT NULL
    AND archived_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_leadgrid_discovery_profile_territory
  ON leadgrid_discovery_profiles (
    organization_id,
    project_id,
    (brief->>'territory_code')
  )
  WHERE status <> 'archived'
    AND NULLIF(brief->>'territory_code', '') IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_discovery_profile_batches (
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  profile_ids UUID[] NOT NULL,
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, project_id, idempotency_key),
  CONSTRAINT leadgrid_discovery_profile_batches_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_profile_batches_hash_check
    CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT leadgrid_discovery_profile_batches_size_check
    CHECK (cardinality(profile_ids) BETWEEN 1 AND 10)
);

COMMENT ON TABLE leadgrid_discovery_profile_batches IS
  'Project-scoped idempotency records for all-or-nothing Discovery profile preset creation.';

CREATE TABLE IF NOT EXISTS leadgrid_discovery_place_confirmations (
  organization_id UUID NOT NULL,
  project_id TEXT NOT NULL,
  run_id UUID NOT NULL,
  candidate_id UUID NOT NULL,
  place_id VARCHAR(255) NOT NULL,
  requested_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  PRIMARY KEY (
    organization_id,
    project_id,
    run_id,
    candidate_id,
    place_id,
    requested_by
  ),
  CONSTRAINT leadgrid_discovery_place_confirmations_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_place_confirmations_run_fk
    FOREIGN KEY (organization_id, project_id, run_id)
    REFERENCES leadgrid_discovery_runs(organization_id, project_id, id)
    ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_place_confirmations_candidate_fk
    FOREIGN KEY (organization_id, project_id, candidate_id)
    REFERENCES leadgrid_discovery_candidates(organization_id, project_id, id)
    ON DELETE CASCADE,
  CONSTRAINT leadgrid_discovery_place_confirmations_expiry_check
    CHECK (expires_at > issued_at),
  CONSTRAINT leadgrid_discovery_place_confirmations_consumed_check
    CHECK (consumed_at IS NULL OR consumed_at >= issued_at)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_place_confirmations_expiry
  ON leadgrid_discovery_place_confirmations (expires_at)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE leadgrid_discovery_place_confirmations IS
  'Short-lived server attestations containing only Google Place IDs returned for an explicit candidate detail lookup.';

DO $crm_candidate_keys$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.crm_customers'::regclass
       AND conname = 'crm_customers_id_organization_project_key'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_id_organization_project_key
      UNIQUE (id, organization_id, project_id);
  END IF;
END
$crm_candidate_keys$;

UPDATE leadgrid_discovery_candidates candidate
   SET existing_lead_id = NULL
 WHERE existing_lead_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers lead
      WHERE lead.id = candidate.existing_lead_id
        AND lead.organization_id = candidate.organization_id
        AND lead.project_id IS NOT DISTINCT FROM candidate.project_id
   );

UPDATE leadgrid_discovery_candidates candidate
   SET imported_lead_id = NULL
 WHERE imported_lead_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers lead
      WHERE lead.id = candidate.imported_lead_id
        AND lead.organization_id = candidate.organization_id
        AND lead.project_id IS NOT DISTINCT FROM candidate.project_id
   );

DO $candidate_lead_scope$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_candidates'::regclass
       AND conname = 'leadgrid_discovery_candidates_existing_lead_scope_fk'
  ) THEN
    ALTER TABLE leadgrid_discovery_candidates
      ADD CONSTRAINT leadgrid_discovery_candidates_existing_lead_scope_fk
      FOREIGN KEY (existing_lead_id, organization_id, project_id)
      REFERENCES crm_customers(id, organization_id, project_id)
      NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_candidates'::regclass
       AND conname = 'leadgrid_discovery_candidates_imported_lead_scope_fk'
  ) THEN
    ALTER TABLE leadgrid_discovery_candidates
      ADD CONSTRAINT leadgrid_discovery_candidates_imported_lead_scope_fk
      FOREIGN KEY (imported_lead_id, organization_id, project_id)
      REFERENCES crm_customers(id, organization_id, project_id)
      NOT VALID;
  END IF;
END
$candidate_lead_scope$;

ALTER TABLE leadgrid_discovery_candidates
  VALIDATE CONSTRAINT leadgrid_discovery_candidates_existing_lead_scope_fk;
ALTER TABLE leadgrid_discovery_candidates
  VALIDATE CONSTRAINT leadgrid_discovery_candidates_imported_lead_scope_fk;

UPDATE leadgrid_discovery_feedback feedback
   SET lead_id = NULL
 WHERE lead_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM crm_customers lead
      WHERE lead.id = feedback.lead_id
        AND lead.organization_id = feedback.organization_id
        AND lead.project_id IS NOT DISTINCT FROM feedback.project_id
   );

DO $feedback_lead_scope$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_feedback'::regclass
       AND conname = 'leadgrid_discovery_feedback_lead_scope_fk'
  ) THEN
    ALTER TABLE leadgrid_discovery_feedback
      ADD CONSTRAINT leadgrid_discovery_feedback_lead_scope_fk
      FOREIGN KEY (lead_id, organization_id, project_id)
      REFERENCES crm_customers(id, organization_id, project_id)
      NOT VALID;
  END IF;
END
$feedback_lead_scope$;

ALTER TABLE leadgrid_discovery_feedback
  VALIDATE CONSTRAINT leadgrid_discovery_feedback_lead_scope_fk;

COMMENT ON COLUMN crm_customers.discovery_territory_code IS
  'Explicit slug from the Discovery profile that promoted the lead; never inferred from a profile name.';
COMMENT ON COLUMN crm_customers.google_place_id_confirmed_at IS
  'When the user explicitly confirmed the persisted Google Place ID during a Discovery promotion.';

COMMIT;
