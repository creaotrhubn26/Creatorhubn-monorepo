-- 0566_leadgrid_discovery_profile_templates_and_talent_privacy.sql
-- Stable onboarding templates, queryable Discovery mirrors and a consent-safe
-- prospect-contact lifecycle for person-oriented Discovery profiles.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE leadgrid_discovery_profiles
  ADD COLUMN IF NOT EXISTS template_key VARCHAR(120),
  ADD COLUMN IF NOT EXISTS template_version INTEGER,
  ADD COLUMN IF NOT EXISTS organization_name_queries TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS country_code CHAR(2),
  ADD COLUMN IF NOT EXISTS subject_kind VARCHAR(16) NOT NULL DEFAULT 'organization',
  ADD COLUMN IF NOT EXISTS qualification_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS qualification_requirement VARCHAR(16) NOT NULL DEFAULT 'preferred';

UPDATE leadgrid_discovery_profiles
   SET organization_name_queries = CASE
         WHEN jsonb_typeof(brief->'organization_name_queries') = 'array'
           THEN ARRAY(
             SELECT jsonb_array_elements_text(brief->'organization_name_queries')
           )
         ELSE ARRAY[]::TEXT[]
       END,
       country_code = CASE WHEN brief->>'country_code' = 'NO' THEN 'NO' END,
       subject_kind = CASE
         WHEN brief->>'subject_kind' = 'person' THEN 'person'
         ELSE 'organization'
       END,
       qualification_terms = CASE
         WHEN jsonb_typeof(brief->'qualification_terms') = 'array'
           THEN ARRAY(SELECT jsonb_array_elements_text(brief->'qualification_terms'))
         ELSE ARRAY[]::TEXT[]
       END,
       qualification_requirement = CASE
         WHEN brief->>'qualification_requirement' = 'required' THEN 'required'
         ELSE 'preferred'
       END
 WHERE organization_name_queries = ARRAY[]::TEXT[]
    OR country_code IS NULL
    OR subject_kind = 'organization'
    OR qualification_terms = ARRAY[]::TEXT[];

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_profiles'::regclass
       AND conname = 'leadgrid_discovery_profiles_template_version_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_profiles
      ADD CONSTRAINT leadgrid_discovery_profiles_template_version_check
      CHECK (
        (template_key IS NULL AND template_version IS NULL)
        OR (template_key IS NOT NULL AND template_version > 0)
      ) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_profiles'::regclass
       AND conname = 'leadgrid_discovery_profiles_country_code_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_profiles
      ADD CONSTRAINT leadgrid_discovery_profiles_country_code_check
      CHECK (country_code IS NULL OR country_code = 'NO') NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_profiles'::regclass
       AND conname = 'leadgrid_discovery_profiles_subject_kind_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_profiles
      ADD CONSTRAINT leadgrid_discovery_profiles_subject_kind_check
      CHECK (subject_kind IN ('organization', 'person')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_discovery_profiles'::regclass
       AND conname = 'leadgrid_discovery_profiles_qualification_requirement_check'
  ) THEN
    ALTER TABLE leadgrid_discovery_profiles
      ADD CONSTRAINT leadgrid_discovery_profiles_qualification_requirement_check
      CHECK (qualification_requirement IN ('preferred', 'required')) NOT VALID;
  END IF;
END
$constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_discovery_profiles_template
  ON leadgrid_discovery_profiles (organization_id, project_id, template_key)
  WHERE template_key IS NOT NULL AND status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_leadgrid_discovery_profiles_name_queries
  ON leadgrid_discovery_profiles USING GIN (organization_name_queries);

ALTER TABLE leadgrid_customer_contacts
  ADD COLUMN IF NOT EXISTS subject_kind VARCHAR(16) NOT NULL DEFAULT 'person',
  ADD COLUMN IF NOT EXISTS privacy_status VARCHAR(24) NOT NULL DEFAULT 'not_applicable',
  ADD COLUMN IF NOT EXISTS consent_status VARCHAR(24) NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS privacy_review_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS do_not_contact_at TIMESTAMPTZ;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_customer_contacts'::regclass
       AND conname = 'leadgrid_customer_contacts_subject_kind_check'
  ) THEN
    ALTER TABLE leadgrid_customer_contacts
      ADD CONSTRAINT leadgrid_customer_contacts_subject_kind_check
      CHECK (subject_kind IN ('person', 'talent')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_customer_contacts'::regclass
       AND conname = 'leadgrid_customer_contacts_privacy_status_check'
  ) THEN
    ALTER TABLE leadgrid_customer_contacts
      ADD CONSTRAINT leadgrid_customer_contacts_privacy_status_check
      CHECK (privacy_status IN (
        'not_applicable', 'notice_required', 'notice_sent', 'opted_out', 'expired'
      )) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.leadgrid_customer_contacts'::regclass
       AND conname = 'leadgrid_customer_contacts_consent_status_check'
  ) THEN
    ALTER TABLE leadgrid_customer_contacts
      ADD CONSTRAINT leadgrid_customer_contacts_consent_status_check
      CHECK (consent_status IN (
        'not_required', 'not_requested', 'received', 'withdrawn'
      )) NOT VALID;
  END IF;
END
$constraints$;

CREATE INDEX IF NOT EXISTS idx_leadgrid_customer_contacts_privacy_review
  ON leadgrid_customer_contacts (privacy_review_due_at, organization_id, project_id, id)
  WHERE subject_kind = 'talent'
    AND privacy_status IN ('notice_required', 'notice_sent');

CREATE OR REPLACE FUNCTION leadgrid_sync_talent_contact_opt_out()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.lead_status = 'do_not_contact'
     AND OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    UPDATE leadgrid_customer_contacts
       SET privacy_status = CASE
             WHEN COALESCE(
               NEW.import_raw_data->'talent_privacy_retention'->>'status',
               ''
             ) = 'expired' THEN 'expired'
             ELSE 'opted_out'
           END,
           consent_status = CASE
             WHEN consent_status = 'received' THEN 'withdrawn'
             ELSE consent_status
           END,
           do_not_contact_at = COALESCE(do_not_contact_at, NOW()),
           updated_at = NOW()
     WHERE customer_id = NEW.id
       AND organization_id = NEW.organization_id
       AND project_id = NEW.project_id
       AND subject_kind = 'talent';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_leadgrid_sync_talent_contact_opt_out ON crm_customers;
CREATE TRIGGER trg_leadgrid_sync_talent_contact_opt_out
AFTER UPDATE OF lead_status ON crm_customers
FOR EACH ROW
EXECUTE FUNCTION leadgrid_sync_talent_contact_opt_out();

ALTER TABLE leadgrid_discovery_profiles
  VALIDATE CONSTRAINT leadgrid_discovery_profiles_template_version_check;
ALTER TABLE leadgrid_discovery_profiles
  VALIDATE CONSTRAINT leadgrid_discovery_profiles_country_code_check;
ALTER TABLE leadgrid_discovery_profiles
  VALIDATE CONSTRAINT leadgrid_discovery_profiles_subject_kind_check;
ALTER TABLE leadgrid_discovery_profiles
  VALIDATE CONSTRAINT leadgrid_discovery_profiles_qualification_requirement_check;
ALTER TABLE leadgrid_customer_contacts
  VALIDATE CONSTRAINT leadgrid_customer_contacts_subject_kind_check;
ALTER TABLE leadgrid_customer_contacts
  VALIDATE CONSTRAINT leadgrid_customer_contacts_privacy_status_check;
ALTER TABLE leadgrid_customer_contacts
  VALIDATE CONSTRAINT leadgrid_customer_contacts_consent_status_check;

COMMENT ON COLUMN leadgrid_discovery_profiles.template_key IS
  'Stable product template identity. Reconciliation may add missing templates but never overwrites a user-edited brief.';
COMMENT ON TABLE leadgrid_customer_contacts IS
  'Project-scoped people linked to a Leadgrid CRM record. Explicit approval may create clinic contacts or a public-data talent prospect; it never creates a Role Room talent account.';
COMMENT ON COLUMN leadgrid_customer_contacts.privacy_review_due_at IS
  'Deadline for suppressing an uncontacted public-data talent prospect. This does not create a Role Room talent account or imply consent.';

COMMIT;
