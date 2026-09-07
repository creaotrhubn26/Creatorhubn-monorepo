-- 0542_leadgrid_preset_project_scope.sql
--
-- Parameter presets and custom-field definitions are organization-wide
-- configuration. Applying a preset, however, creates a lead inside one
-- authoritative Leadgrid customer project. This migration makes the
-- organization/preset relationship enforceable by the database and rejects
-- cross-organization preset links.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- Composite keys let dependent rows prove that a globally unique config id
-- also belongs to the expected organization.
DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'lead_parameter_presets'::regclass
       AND conname = 'lead_parameter_presets_organization_id_key'
  ) THEN
    ALTER TABLE lead_parameter_presets
      ADD CONSTRAINT lead_parameter_presets_organization_id_key
      UNIQUE (organization_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'lead_custom_field_definitions'::regclass
       AND conname = 'lead_custom_field_definitions_organization_id_key'
  ) THEN
    ALTER TABLE lead_custom_field_definitions
      ADD CONSTRAINT lead_custom_field_definitions_organization_id_key
      UNIQUE (organization_id, id);
  END IF;
END
$constraints$;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS lead_parameter_preset_id UUID;

-- There is no authoritative source from which to invent a preset for historic
-- leads. If this migration resumes after a partial deployment, retain only
-- references already proven to belong to the lead organization.
UPDATE crm_customers lead
   SET lead_parameter_preset_id = NULL
 WHERE lead.lead_parameter_preset_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM lead_parameter_presets preset
      WHERE preset.organization_id = lead.organization_id
        AND preset.id = lead.lead_parameter_preset_id
   );

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'crm_customers'::regclass
       AND conname = 'crm_customers_lead_parameter_preset_scope_fkey'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_lead_parameter_preset_scope_fkey
      FOREIGN KEY (organization_id, lead_parameter_preset_id)
      REFERENCES lead_parameter_presets(organization_id, id)
      ON UPDATE CASCADE
      ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'crm_customers'::regclass
       AND conname = 'crm_customers_lead_parameter_preset_org_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_lead_parameter_preset_org_check
      CHECK (
        lead_parameter_preset_id IS NULL
        OR organization_id IS NOT NULL
      )
      NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE crm_customers
  VALIDATE CONSTRAINT crm_customers_lead_parameter_preset_scope_fkey;
ALTER TABLE crm_customers
  VALIDATE CONSTRAINT crm_customers_lead_parameter_preset_org_check;

-- UUID arrays cannot carry a native composite foreign key. Remove only links
-- that cannot be proven through the same organization, then enforce the
-- invariant for all future direct and application writes with a trigger.
UPDATE lead_custom_field_definitions definition
   SET preset_ids = ARRAY(
     SELECT DISTINCT requested.preset_id
       FROM unnest(
         COALESCE(definition.preset_ids, ARRAY[]::UUID[])
       ) AS requested(preset_id)
       JOIN lead_parameter_presets preset
         ON preset.organization_id = definition.organization_id
        AND preset.id = requested.preset_id
      ORDER BY requested.preset_id
   )
 WHERE EXISTS (
   SELECT 1
     FROM unnest(
       COALESCE(definition.preset_ids, ARRAY[]::UUID[])
     ) AS requested(preset_id)
     LEFT JOIN lead_parameter_presets preset
       ON preset.organization_id = definition.organization_id
      AND preset.id = requested.preset_id
    WHERE preset.id IS NULL
 );

CREATE OR REPLACE FUNCTION enforce_lead_custom_field_preset_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM unnest(COALESCE(NEW.preset_ids, ARRAY[]::UUID[]))
        AS requested(preset_id)
      LEFT JOIN lead_parameter_presets preset
        ON preset.organization_id = NEW.organization_id
       AND preset.id = requested.preset_id
     WHERE preset.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'custom field preset_ids must belong to the same organization'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_lead_custom_field_preset_scope
  ON lead_custom_field_definitions;
CREATE TRIGGER trg_lead_custom_field_preset_scope
BEFORE INSERT OR UPDATE OF organization_id, preset_ids
ON lead_custom_field_definitions
FOR EACH ROW
EXECUTE FUNCTION enforce_lead_custom_field_preset_scope();

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_parameter_preset
  ON crm_customers (organization_id, lead_parameter_preset_id)
  WHERE organization_id IS NOT NULL
    AND lead_parameter_preset_id IS NOT NULL;

COMMENT ON COLUMN crm_customers.lead_parameter_preset_id IS
  'Organization-bound Leadgrid parameter preset applied when the lead was created.';
COMMENT ON FUNCTION enforce_lead_custom_field_preset_scope() IS
  'Rejects custom-field preset links that cross the organization boundary.';

COMMIT;
