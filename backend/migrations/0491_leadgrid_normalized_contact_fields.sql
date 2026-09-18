-- 0491_leadgrid_normalized_contact_fields.sql
--
-- Persistente, database-eide matchnøkler for e-post og telefon. En trigger
-- holder dem korrekte for ALLE skrivestier, også eldre CRM-ruter som ikke går
-- gjennom Leadgrids kanoniske opprettelsestjeneste.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(32);

CREATE OR REPLACE FUNCTION sync_crm_customer_normalized_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $normalized_contact$
DECLARE
  phone_digits TEXT;
BEGIN
  NEW.email_normalized := NULLIF(LOWER(BTRIM(COALESCE(NEW.email, ''))), '');
  phone_digits := REGEXP_REPLACE(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g');
  NEW.phone_normalized := NULLIF(
    CASE
      WHEN LENGTH(phone_digits) >= 8 THEN RIGHT(phone_digits, 8)
      ELSE phone_digits
    END,
    ''
  );
  RETURN NEW;
END;
$normalized_contact$;

DROP TRIGGER IF EXISTS trg_crm_customers_normalized_contact ON crm_customers;
CREATE TRIGGER trg_crm_customers_normalized_contact
BEFORE INSERT OR UPDATE OF email, phone, email_normalized, phone_normalized
ON crm_customers
FOR EACH ROW
EXECUTE FUNCTION sync_crm_customer_normalized_contact();

-- Triggeren kjøres også under backfill og korrigerer eventuelle gamle,
-- inkonsistente email_normalized-verdier.
UPDATE crm_customers
SET email = email,
    phone = phone
WHERE email IS NOT NULL
   OR phone IS NOT NULL
   OR email_normalized IS NOT NULL
   OR phone_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_email_normalized
  ON crm_customers (organization_id, email_normalized)
  WHERE organization_id IS NOT NULL
    AND email_normalized IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_phone_normalized
  ON crm_customers (organization_id, phone_normalized)
  WHERE organization_id IS NOT NULL
    AND phone_normalized IS NOT NULL
    AND archived_at IS NULL;

-- Erstatt dyrere uttrykksindekser når de persistente matchnøklene finnes.
DROP INDEX IF EXISTS idx_crm_customers_org_email_lower;
DROP INDEX IF EXISTS idx_crm_customers_org_phone_digits;

COMMENT ON COLUMN crm_customers.email_normalized IS
  'Database-normalized lowercase/trimmed email used for tenant-scoped matching.';
COMMENT ON COLUMN crm_customers.phone_normalized IS
  'Database-normalized last-eight-digit phone match key used for tenant-scoped matching.';

COMMIT;
