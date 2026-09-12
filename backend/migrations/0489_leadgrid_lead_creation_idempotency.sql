-- 0489_leadgrid_lead_creation_idempotency.sql
--
-- Gjør manuell lead-opprettelse retry-sikker og legger til normaliserte,
-- workspace-scope-de duplikatoppslag. Kolonnene er nullable for å bevare
-- kompatibilitet med eldre klienter og andre opprettelsesflyter.

BEGIN;

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS creation_idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS creation_request_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS website_domain_normalized VARCHAR(253);

-- The idempotency key and payload hash form one contract. Named constraints
-- keep partial rollout and later introspection deterministic.
DO $lead_creation_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.crm_customers'::regclass
      AND conname = 'crm_customers_creation_request_hash_format_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_creation_request_hash_format_check
      CHECK (
        creation_request_hash IS NULL
        OR creation_request_hash ~ '^[0-9a-f]{64}$'
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.crm_customers'::regclass
      AND conname = 'crm_customers_creation_idempotency_pair_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_creation_idempotency_pair_check
      CHECK (
        (creation_idempotency_key IS NULL) =
        (creation_request_hash IS NULL)
      ) NOT VALID;
  END IF;
END
$lead_creation_contract$;

-- Best-effort backfill for eksisterende URL-er. Nye writes normaliseres av
-- backend med URL-parseren før de lagres.
UPDATE crm_customers
SET website_domain_normalized = NULLIF(
  LOWER(
    SPLIT_PART(
      SPLIT_PART(
        REGEXP_REPLACE(
          REGEXP_REPLACE(BTRIM(website_url), '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''),
          '^www\\.', '', 'i'
        ),
        '/', 1
      ),
      ':', 1
    )
  ),
  ''
)
WHERE website_url IS NOT NULL
  AND BTRIM(website_url) <> ''
  AND website_domain_normalized IS NULL;

ALTER TABLE crm_customers
  VALIDATE CONSTRAINT crm_customers_creation_request_hash_format_check;
ALTER TABLE crm_customers
  VALIDATE CONSTRAINT crm_customers_creation_idempotency_pair_check;

-- Samme skjemasesjon kan kun opprette én lead i et workspace. Request-hash
-- brukes av backend til å avvise gjenbruk av nøkkelen med et annet payload.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_customers_org_creation_idempotency
  ON crm_customers (organization_id, creation_idempotency_key)
  WHERE organization_id IS NOT NULL
    AND creation_idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_google_place
  ON crm_customers (organization_id, google_place_id)
  WHERE organization_id IS NOT NULL
    AND google_place_id IS NOT NULL
    AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_crm_customers_org_website_domain
  ON crm_customers (organization_id, website_domain_normalized)
  WHERE organization_id IS NOT NULL
    AND website_domain_normalized IS NOT NULL
    AND archived_at IS NULL;

COMMENT ON COLUMN crm_customers.creation_idempotency_key IS
  'Stable UUID for one logical lead-creation form session; unique per workspace.';
COMMENT ON COLUMN crm_customers.creation_request_hash IS
  'SHA-256 of the normalized lead-creation payload for idempotency conflict detection.';
COMMENT ON COLUMN crm_customers.website_domain_normalized IS
  'Lowercase hostname without www, scheme, port, path or trailing dot.';

COMMIT;
