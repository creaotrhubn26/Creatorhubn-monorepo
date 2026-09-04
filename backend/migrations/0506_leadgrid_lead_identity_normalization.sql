-- Migration 0506: canonical e-mail/phone identities and tenant-scoped
-- geographic lookup support for Leadgrid lead creation.
BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS phone_normalized VARCHAR(32);

CREATE OR REPLACE FUNCTION leadgrid_normalize_phone(input_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
PARALLEL SAFE
AS $normalize$
  SELECT CASE
    WHEN digits = '' THEN NULL
    WHEN digits LIKE '00%' THEN '+' || SUBSTRING(digits FROM 3)
    WHEN LENGTH(digits) = 8 THEN '+47' || digits
    ELSE '+' || digits
  END
  FROM (
    SELECT REGEXP_REPLACE(COALESCE(input_value, ''), '[^0-9]', '', 'g') AS digits
  ) normalized;
$normalize$;

CREATE OR REPLACE FUNCTION leadgrid_sync_customer_identities()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $sync$
BEGIN
  NEW.email_normalized := NULLIF(LOWER(BTRIM(NEW.email)), '');
  NEW.phone_normalized := leadgrid_normalize_phone(NEW.phone);
  RETURN NEW;
END
$sync$;

UPDATE crm_customers
   SET email_normalized = NULLIF(LOWER(BTRIM(email)), ''),
       phone_normalized = leadgrid_normalize_phone(phone)
 WHERE email_normalized IS DISTINCT FROM NULLIF(LOWER(BTRIM(email)), '')
    OR phone_normalized IS DISTINCT FROM leadgrid_normalize_phone(phone);

DO $trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger
     WHERE tgname = 'trg_leadgrid_customer_identities'
       AND tgrelid = 'public.crm_customers'::regclass
       AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_leadgrid_customer_identities
      BEFORE INSERT OR UPDATE OF email, phone
      ON crm_customers
      FOR EACH ROW
      EXECUTE FUNCTION leadgrid_sync_customer_identities();
  END IF;
END
$trigger$;

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

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_coordinates
  ON crm_customers (organization_id, latitude, longitude)
  WHERE organization_id IS NOT NULL
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND archived_at IS NULL;

COMMENT ON COLUMN crm_customers.email_normalized IS
  'Trimmed lowercase e-mail used for tenant-scoped duplicate matching.';
COMMENT ON COLUMN crm_customers.phone_normalized IS
  'Digits in E.164-like form; Norwegian 8-digit numbers receive +47.';

COMMIT;
