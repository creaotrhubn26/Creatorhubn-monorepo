-- 0539_leadgrid_agency_lead_promotion_scope.sql
--
-- Incoming agency leads are a source queue, not Leadgrid CRM leads. Promotion
-- must therefore persist an explicit, tenant-bound mapping before the CRM lead
-- can be assigned. The tuple also makes retries idempotent and prevents an
-- agency-lead UUID from being mistaken for a crm_customers UUID in clients.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE agency_leads
  ADD COLUMN IF NOT EXISTS leadgrid_organization_id UUID,
  ADD COLUMN IF NOT EXISTS leadgrid_project_id TEXT,
  ADD COLUMN IF NOT EXISTS leadgrid_customer_id UUID,
  ADD COLUMN IF NOT EXISTS leadgrid_promoted_at TIMESTAMPTZ;

-- The legacy route omitted crm_customers.organization_id. Recover it only when
-- its source metadata resolves to exactly one project and one CRM customer.
-- Ambiguous rows remain untouched for manual reconciliation.
WITH legacy_customer_scope AS (
  SELECT source.id AS source_id,
         MIN(project.organization_id::text)::uuid AS organization_id,
         MIN(customer.id::text)::uuid AS customer_id
    FROM agency_leads source
    JOIN leadgrid_projects project
      ON project.metadata ->> 'source_lead_id' = source.id::text
     AND project.organization_id IS NOT NULL
    JOIN crm_customers customer
      ON customer.project_id = project.id
     AND customer.organization_id IS NULL
   WHERE source.leadgrid_customer_id IS NULL
   GROUP BY source.id
  HAVING COUNT(DISTINCT customer.id) = 1
     AND COUNT(DISTINCT (project.organization_id, project.id)) = 1
)
UPDATE crm_customers customer
   SET organization_id = scope.organization_id,
       updated_at = NOW()
  FROM legacy_customer_scope scope
 WHERE customer.id = scope.customer_id
   AND customer.organization_id IS NULL;

-- Reconcile rows produced by the legacy accept route. It created a dedicated
-- project carrying source_lead_id metadata and exactly one CRM customer. Rows
-- with ambiguous/missing relationships remain unmapped and fail closed.
WITH legacy_mapping AS (
  SELECT source.id AS source_id,
         MIN(project.organization_id::text)::uuid AS organization_id,
         MIN(project.id) AS project_id,
         MIN(customer.id::text)::uuid AS customer_id
    FROM agency_leads source
    JOIN leadgrid_projects project
      ON project.metadata ->> 'source_lead_id' = source.id::text
     AND project.organization_id IS NOT NULL
    JOIN crm_customers customer
      ON customer.organization_id = project.organization_id
     AND customer.project_id = project.id
   WHERE source.leadgrid_customer_id IS NULL
   GROUP BY source.id
  HAVING COUNT(DISTINCT customer.id) = 1
     AND COUNT(DISTINCT (project.organization_id, project.id)) = 1
)
UPDATE agency_leads source
   SET leadgrid_organization_id = mapping.organization_id,
       leadgrid_project_id = mapping.project_id,
       leadgrid_customer_id = mapping.customer_id,
       leadgrid_promoted_at = COALESCE(source.customer_at, source.updated_at, NOW())
  FROM legacy_mapping mapping
 WHERE source.id = mapping.source_id
   AND source.leadgrid_customer_id IS NULL;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'agency_leads'::regclass
       AND conname = 'agency_leads_leadgrid_mapping_complete_check'
  ) THEN
    ALTER TABLE agency_leads
      ADD CONSTRAINT agency_leads_leadgrid_mapping_complete_check
      CHECK (
        (
          leadgrid_organization_id IS NULL
          AND leadgrid_project_id IS NULL
          AND leadgrid_customer_id IS NULL
          AND leadgrid_promoted_at IS NULL
        )
        OR (
          leadgrid_organization_id IS NOT NULL
          AND leadgrid_project_id IS NOT NULL
          AND leadgrid_customer_id IS NOT NULL
          AND leadgrid_promoted_at IS NOT NULL
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'agency_leads'::regclass
       AND conname = 'agency_leads_leadgrid_project_scope_fkey'
  ) THEN
    ALTER TABLE agency_leads
      ADD CONSTRAINT agency_leads_leadgrid_project_scope_fkey
      FOREIGN KEY (leadgrid_organization_id, leadgrid_project_id)
      REFERENCES leadgrid_projects(organization_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'agency_leads'::regclass
       AND conname = 'agency_leads_leadgrid_customer_scope_fkey'
  ) THEN
    ALTER TABLE agency_leads
      ADD CONSTRAINT agency_leads_leadgrid_customer_scope_fkey
      FOREIGN KEY (
        leadgrid_organization_id,
        leadgrid_project_id,
        leadgrid_customer_id
      )
      REFERENCES crm_customers(organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE agency_leads
  VALIDATE CONSTRAINT agency_leads_leadgrid_mapping_complete_check;
ALTER TABLE agency_leads
  VALIDATE CONSTRAINT agency_leads_leadgrid_project_scope_fkey;
ALTER TABLE agency_leads
  VALIDATE CONSTRAINT agency_leads_leadgrid_customer_scope_fkey;

CREATE UNIQUE INDEX IF NOT EXISTS uq_agency_leads_leadgrid_customer
  ON agency_leads (leadgrid_customer_id)
  WHERE leadgrid_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agency_leads_leadgrid_project
  ON agency_leads (
    leadgrid_organization_id,
    leadgrid_project_id,
    leadgrid_promoted_at DESC
  )
  WHERE leadgrid_customer_id IS NOT NULL;

-- Older environments retained the original 241 status constraint, even though
-- the acceptance routes have long used converted/rejected.
ALTER TABLE agency_leads
  DROP CONSTRAINT IF EXISTS agency_leads_status_check;
ALTER TABLE agency_leads
  ADD CONSTRAINT agency_leads_status_check
  CHECK (status IN (
    'new', 'contacted', 'demo_booked', 'trial', 'customer',
    'disqualified', 'archived', 'converted', 'rejected'
  )) NOT VALID;
ALTER TABLE agency_leads
  VALIDATE CONSTRAINT agency_leads_status_check;

COMMENT ON COLUMN agency_leads.leadgrid_customer_id IS
  'Persisted CRM lead returned by promotion; clients must never use agency_leads.id as a CRM lead id.';

COMMIT;
