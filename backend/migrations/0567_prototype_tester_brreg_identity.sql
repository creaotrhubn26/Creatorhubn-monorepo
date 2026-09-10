-- Preserve the BRREG-verified legal identity used when a prototype tester
-- represents a Norwegian company. The immutable agreement snapshot then
-- contains the exact company name, organization number and business address
-- that were verified before the invitation was created.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE prototype_tester_invites
  ADD COLUMN IF NOT EXISTS member_company VARCHAR(200),
  ADD COLUMN IF NOT EXISTS member_organization_number VARCHAR(9),
  ADD COLUMN IF NOT EXISTS member_business_address VARCHAR(500);

ALTER TABLE prototype_tester_invites
  ALTER COLUMN member_company TYPE VARCHAR(200);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'prototype_tester_invites_member_org_number_format'
       AND conrelid = 'prototype_tester_invites'::regclass
  ) THEN
    ALTER TABLE prototype_tester_invites
      ADD CONSTRAINT prototype_tester_invites_member_org_number_format
      CHECK (
        member_organization_number IS NULL
        OR member_organization_number ~ '^[0-9]{9}$'
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_prototype_tester_invites_member_org_number
  ON prototype_tester_invites (member_organization_number)
  WHERE member_organization_number IS NOT NULL;

COMMENT ON COLUMN prototype_tester_invites.member_organization_number IS
  'Nine-digit organization number verified against the BRREG Enhetsregisteret API before a direct invitation is created.';

COMMENT ON COLUMN prototype_tester_invites.member_business_address IS
  'Business address returned by BRREG and included in the personalized agreement bundle and signing evidence.';

COMMIT;
