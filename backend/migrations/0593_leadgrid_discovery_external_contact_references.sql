-- 0593: Idempotent external contact linkage for approved Discovery accounts.
-- The reference is a provider-scoped one-way digest; raw HPR identifiers are
-- deliberately not persisted by the Fastlegeregister adapter.

BEGIN;

ALTER TABLE leadgrid_customer_contacts
  ADD COLUMN IF NOT EXISTS source_reference VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS ux_leadgrid_customer_contacts_source_reference
  ON leadgrid_customer_contacts (
    organization_id, project_id, customer_id, source, source_reference
  )
  WHERE source_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_customer_contacts_person_privacy_review
  ON leadgrid_customer_contacts (
    privacy_review_due_at, organization_id, project_id, id
  )
  WHERE subject_kind = 'person'
    AND privacy_status IN ('notice_required', 'notice_sent');

COMMENT ON COLUMN leadgrid_customer_contacts.source_reference IS
  'Provider-scoped one-way reference used for idempotent contact linkage; never a raw HPR identifier.';

COMMIT;
