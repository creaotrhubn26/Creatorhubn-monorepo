-- 0564_leadgrid_discovery_clinic_grouping.sql
--
-- Treat a public-facing clinic as the sales account and retain unambiguously
-- co-located dental practitioners as project-scoped contacts. Classification
-- is evidence-based and conservative: an address without a street number, or
-- an address containing multiple clinic candidates, is never auto-grouped.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_discovery_candidates
  ADD COLUMN IF NOT EXISTS entity_kind VARCHAR(24) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS entity_kind_confidence VARCHAR(12) NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS entity_kind_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS normalized_location_key VARCHAR(512);

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_candidates'::regclass
       AND conname = 'leadgrid_discovery_candidates_entity_kind_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_candidates
      ADD CONSTRAINT leadgrid_discovery_candidates_entity_kind_check
      CHECK (entity_kind IN ('clinic', 'practitioner', 'unknown')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_candidates'::regclass
       AND conname = 'leadgrid_discovery_candidates_entity_confidence_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_candidates
      ADD CONSTRAINT leadgrid_discovery_candidates_entity_confidence_check
      CHECK (entity_kind_confidence IN ('high', 'medium', 'low')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_candidates'::regclass
       AND conname = 'leadgrid_discovery_candidates_entity_evidence_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_candidates
      ADD CONSTRAINT leadgrid_discovery_candidates_entity_evidence_check
      CHECK (jsonb_typeof(entity_kind_evidence) = 'array') NOT VALID;
  END IF;
END
$constraints$;

-- Make the already-discovered Dentum batch useful immediately. Runtime writes
-- use the equivalent TypeScript classifier and replace this bounded backfill
-- whenever a candidate is observed again.
WITH source AS (
  SELECT id,
         UPPER(COALESCE(name, '')) AS candidate_name,
         UPPER(COALESCE(address, '')) AS candidate_address,
         UPPER(COALESCE(raw_data->>'organization_form_code', '')) AS form_code,
         COALESCE(raw_data->>'nace_code', '') AS nace_code,
         UPPER(COALESCE(raw_data->>'nace_description', '')) AS nace_description,
         CASE
           WHEN COALESCE(raw_data->>'employee_count', '') ~ '^[0-9]+$'
             THEN (raw_data->>'employee_count')::integer
           ELSE 0
         END AS employee_count,
         website_url,
         COALESCE(
           substring(address FROM '([^,]*[0-9][^,]*)$'),
           CASE WHEN address ~ '[0-9]' THEN address END
         ) AS street_part,
         postal_code,
         city
    FROM leadgrid_discovery_candidates
), classified AS (
  SELECT id,
         CASE
           WHEN nace_code <> '86.230'
             AND nace_description !~ '(TANN|DENTAL|ODONTOLOG)'
             THEN 'unknown'
           WHEN candidate_name ~ '(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT|ODONTOLOGISK[[:space:]]+KLINIKK|KLINIKKDRIFT|TANNLEGE[[:space:]]+TEAM)'
             THEN 'clinic'
           WHEN candidate_address ~ '(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT)'
             THEN 'practitioner'
           WHEN form_code = 'ENK' THEN 'practitioner'
           WHEN candidate_name ~ '^TANNLEGE([[:space:]]+DR\.?)?[[:space:]]+'
             THEN 'practitioner'
           WHEN candidate_name ~ '(TANN|DENTAL|ODONTOLOG)'
             AND (employee_count >= 2 OR website_url IS NOT NULL)
             THEN 'clinic'
           ELSE 'unknown'
         END AS entity_kind,
         CASE
           WHEN candidate_name ~ '(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT|ODONTOLOGISK[[:space:]]+KLINIKK|KLINIKKDRIFT|TANNLEGE[[:space:]]+TEAM)'
             OR candidate_address ~ '(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT)'
             OR form_code = 'ENK'
             THEN 'high'
           WHEN candidate_name ~ '^TANNLEGE([[:space:]]+DR\.?)?[[:space:]]+'
             THEN 'medium'
           WHEN candidate_name ~ '(TANN|DENTAL|ODONTOLOG)'
             AND (employee_count >= 2 OR website_url IS NOT NULL)
             THEN 'medium'
           ELSE 'low'
         END AS confidence,
         CASE
           WHEN candidate_name ~ '(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT|ODONTOLOGISK[[:space:]]+KLINIKK|KLINIKKDRIFT|TANNLEGE[[:space:]]+TEAM)'
             THEN '["public_clinic_name"]'::jsonb
           WHEN candidate_address ~ '(TANNKLINIKK|TANNLEGEKLINIKK|TANNLEGESENTER|TANNHELSESENTER|TANNHELSEKLINIKK|TANNLEGEVAKT)'
             THEN '["clinic_named_in_registered_address"]'::jsonb
           WHEN form_code = 'ENK'
             THEN '["sole_proprietorship_dental_entity"]'::jsonb
           WHEN candidate_name ~ '^TANNLEGE([[:space:]]+DR\.?)?[[:space:]]+'
             THEN '["named_dentist_entity"]'::jsonb
           WHEN candidate_name ~ '(TANN|DENTAL|ODONTOLOG)'
             AND employee_count >= 2
             THEN '["dental_entity_with_employees"]'::jsonb
           WHEN candidate_name ~ '(TANN|DENTAL|ODONTOLOG)'
             AND website_url IS NOT NULL
             THEN '["dental_entity_with_public_website"]'::jsonb
           ELSE '["insufficient_clinic_identity_evidence"]'::jsonb
         END AS evidence,
         CASE
           WHEN street_part IS NULL
             OR street_part ~* '^[[:space:]]*(postboks|pb)[[:space:]]*[0-9]'
             OR (NULLIF(BTRIM(COALESCE(postal_code, '')), '') IS NULL
                 AND NULLIF(BTRIM(COALESCE(city, '')), '') IS NULL)
             THEN NULL
           ELSE
             LOWER(REGEXP_REPLACE(
               TRANSLATE(street_part, 'ÆØÅæøå', 'AOAaoa'),
               '[^A-Za-z0-9]+', '', 'g'
             )) || '|' ||
             LOWER(REGEXP_REPLACE(
               TRANSLATE(COALESCE(postal_code, ''), 'ÆØÅæøå', 'AOAaoa'),
               '[^A-Za-z0-9]+', '', 'g'
             )) || '|' ||
             LOWER(REGEXP_REPLACE(
               TRANSLATE(COALESCE(city, ''), 'ÆØÅæøå', 'AOAaoa'),
               '[^A-Za-z0-9]+', '', 'g'
             ))
         END AS location_key
    FROM source
   WHERE nace_code = '86.230'
      OR nace_description ~ '(TANN|DENTAL|ODONTOLOG)'
)
UPDATE leadgrid_discovery_candidates candidate
   SET entity_kind = classified.entity_kind,
       entity_kind_confidence = classified.confidence,
       entity_kind_evidence = classified.evidence,
       normalized_location_key = classified.location_key
  FROM classified
 WHERE candidate.id = classified.id;

ALTER TABLE leadgrid_discovery_candidates
  VALIDATE CONSTRAINT leadgrid_discovery_candidates_entity_kind_check;
ALTER TABLE leadgrid_discovery_candidates
  VALIDATE CONSTRAINT leadgrid_discovery_candidates_entity_confidence_check;
ALTER TABLE leadgrid_discovery_candidates
  VALIDATE CONSTRAINT leadgrid_discovery_candidates_entity_evidence_check;

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_candidates_clinic_location
  ON leadgrid_discovery_candidates (
    organization_id, project_id, normalized_location_key, entity_kind
  )
  WHERE normalized_location_key IS NOT NULL
    AND entity_kind IN ('clinic', 'practitioner');

CREATE TABLE IF NOT EXISTS leadgrid_customer_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL,
  customer_id UUID NOT NULL,
  name TEXT NOT NULL,
  role VARCHAR(160),
  organization_number VARCHAR(32),
  source VARCHAR(32) NOT NULL DEFAULT 'discovery'
    CHECK (source IN ('discovery', 'manual', 'import')),
  source_candidate_id UUID,
  relationship_confidence VARCHAR(12)
    CHECK (relationship_confidence IS NULL OR relationship_confidence IN ('high', 'medium')),
  relationship_evidence JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(relationship_evidence) = 'array'),
  confirmed_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leadgrid_customer_contacts_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_customer_contacts_customer_fk
    FOREIGN KEY (customer_id, organization_id, project_id)
    REFERENCES crm_customers(id, organization_id, project_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT leadgrid_customer_contacts_candidate_fk
    FOREIGN KEY (organization_id, project_id, source_candidate_id)
    REFERENCES leadgrid_discovery_candidates(organization_id, project_id, id)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_customer_contacts_discovery_source
  ON leadgrid_customer_contacts (
    organization_id, project_id, customer_id, source_candidate_id
  )
  WHERE source_candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_customer_contacts_customer
  ON leadgrid_customer_contacts (
    organization_id, project_id, customer_id, created_at, id
  );

COMMENT ON TABLE leadgrid_customer_contacts IS
  'Project-scoped people associated with a Leadgrid CRM account. Discovery contacts are created only through explicit approval of a visible clinic group.';
COMMENT ON COLUMN leadgrid_discovery_candidates.normalized_location_key IS
  'Conservative street/postcode/city key used for clinic grouping; never a general lead identity key.';

COMMIT;
