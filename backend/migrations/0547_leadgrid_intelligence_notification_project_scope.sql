-- 0547_leadgrid_intelligence_notification_project_scope.sql
--
-- Project isolation for Leadgrid intelligence history, recommendations,
-- Leadgrid notification events and webhook retry deliveries.
--
-- Historical rows created before project scope existed are deliberately
-- backfilled only when their organization has exactly one Leadgrid project.
-- In a multi-project organization the current lead.project_id is not reliable
-- historical provenance because a lead may have moved between projects. Those
-- unresolved rows remain nullable legacy audit rows and are excluded by the
-- project-scoped readers. Active unresolved recommendations are expired.

-- Additive/expand-only. Migration 0547 must run before the corresponding
-- application version starts writing the new columns.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE lead_scores_history
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE lead_recommendations
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE notification_events
  ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE webhook_delivery_queue
  ADD COLUMN IF NOT EXISTS organization_id UUID,
  ADD COLUMN IF NOT EXISTS project_id TEXT;

-- A queue row already has a mandatory subscription FK, so organization scope
-- can always be recovered without guessing.
UPDATE webhook_delivery_queue queue
   SET organization_id = subscription.organization_id
  FROM leadgrid_webhook_subscriptions subscription
 WHERE subscription.id = queue.subscription_id
   AND queue.organization_id IS DISTINCT FROM subscription.organization_id;

ALTER TABLE webhook_delivery_queue
  ALTER COLUMN organization_id SET NOT NULL;

-- Project provenance embedded by newer emitters can be recovered only when it
-- names a project belonging to the queue subscription's organization.
UPDATE webhook_delivery_queue queue
   SET project_id = project.id
  FROM leadgrid_webhook_subscriptions subscription
  JOIN leadgrid_projects project
    ON project.organization_id = subscription.organization_id
 WHERE subscription.id = queue.subscription_id
   AND queue.project_id IS NULL
   AND NULLIF(BTRIM(queue.payload ->> 'project_id'), '') = project.id
   AND (
     NULLIF(BTRIM(queue.payload ->> 'organization_id'), '') IS NULL
     OR queue.payload ->> 'organization_id' = subscription.organization_id::text
   );

-- Only a single-project organization makes legacy lead-derived scope
-- unambiguous. Count archived projects too: their existence still proves that
-- simply copying the lead's current project would be unsafe history rewriting.
WITH single_project_organizations AS (
  SELECT organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
), scoped_history AS (
  SELECT history.id, customer.project_id
    FROM lead_scores_history history
    JOIN crm_customers customer
      ON customer.id = history.lead_id
     AND customer.organization_id = history.organization_id
    JOIN single_project_organizations singleton
      ON singleton.organization_id = history.organization_id
     AND singleton.project_id = customer.project_id
   WHERE history.project_id IS NULL
)
UPDATE lead_scores_history history
   SET project_id = scoped.project_id
  FROM scoped_history scoped
 WHERE history.id = scoped.id;

WITH single_project_organizations AS (
  SELECT organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
), scoped_recommendations AS (
  SELECT recommendation.id, customer.project_id
    FROM lead_recommendations recommendation
    JOIN crm_customers customer
      ON customer.id = recommendation.lead_id
     AND customer.organization_id = recommendation.organization_id
    JOIN single_project_organizations singleton
      ON singleton.organization_id = recommendation.organization_id
     AND singleton.project_id = customer.project_id
   WHERE recommendation.project_id IS NULL
)
UPDATE lead_recommendations recommendation
   SET project_id = scoped.project_id
  FROM scoped_recommendations scoped
 WHERE recommendation.id = scoped.id;

-- A notification can also carry explicit project provenance in its own meta.
-- Otherwise use the same conservative single-project rule as intelligence.
WITH single_project_organizations AS (
  SELECT organization_id, MIN(id) AS project_id
    FROM leadgrid_projects
   WHERE organization_id IS NOT NULL
   GROUP BY organization_id
  HAVING COUNT(*) = 1
), scoped_notifications AS (
  SELECT event.id, customer.project_id
    FROM notification_events event
    JOIN crm_customers customer
      ON customer.id = event.lead_id
     AND customer.organization_id = event.organization_id
    LEFT JOIN single_project_organizations singleton
      ON singleton.organization_id = event.organization_id
     AND singleton.project_id = customer.project_id
   WHERE event.project_id IS NULL
     AND (
       singleton.project_id IS NOT NULL
       OR NULLIF(BTRIM(event.meta ->> 'project_id'), '') = customer.project_id
     )
)
UPDATE notification_events event
   SET project_id = scoped.project_id
  FROM scoped_notifications scoped
 WHERE event.id = scoped.id;

-- Unscoped active recommendations must never surface or be executed after the
-- project-scoped runtime is deployed. Preserve them for audit, but close them.
UPDATE lead_recommendations
   SET status = 'expired',
       expires_at = COALESCE(expires_at, NOW())
 WHERE project_id IS NULL
   AND status IN ('pending', 'accepted');

-- Composite parents used by exact tenant/project foreign keys.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'leadgrid_webhook_subscriptions'::regclass
       AND conname = 'leadgrid_webhook_subscriptions_org_id_id_key'
  ) THEN
    ALTER TABLE leadgrid_webhook_subscriptions
      ADD CONSTRAINT leadgrid_webhook_subscriptions_org_id_id_key
      UNIQUE (organization_id, id);
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_scores_history'::regclass
       AND conname = 'lead_scores_history_project_required_check'
  ) THEN
    ALTER TABLE lead_scores_history
      ADD CONSTRAINT lead_scores_history_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_recommendations'::regclass
       AND conname = 'lead_recommendations_project_required_check'
  ) THEN
    ALTER TABLE lead_recommendations
      ADD CONSTRAINT lead_recommendations_project_required_check
      CHECK (project_id IS NOT NULL) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'notification_events'::regclass
       AND conname = 'notification_events_project_requires_org_check'
  ) THEN
    ALTER TABLE notification_events
      ADD CONSTRAINT notification_events_project_requires_org_check
      CHECK (project_id IS NULL OR organization_id IS NOT NULL) NOT VALID;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_scores_history'::regclass
       AND conname = 'lead_scores_history_project_scope_fkey'
  ) THEN
    ALTER TABLE lead_scores_history
      ADD CONSTRAINT lead_scores_history_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_scores_history'::regclass
       AND conname = 'lead_scores_history_lead_scope_fkey'
  ) THEN
    ALTER TABLE lead_scores_history
      ADD CONSTRAINT lead_scores_history_lead_scope_fkey
      FOREIGN KEY (organization_id, project_id, lead_id)
      REFERENCES crm_customers (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_recommendations'::regclass
       AND conname = 'lead_recommendations_project_scope_fkey'
  ) THEN
    ALTER TABLE lead_recommendations
      ADD CONSTRAINT lead_recommendations_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'lead_recommendations'::regclass
       AND conname = 'lead_recommendations_lead_scope_fkey'
  ) THEN
    ALTER TABLE lead_recommendations
      ADD CONSTRAINT lead_recommendations_lead_scope_fkey
      FOREIGN KEY (organization_id, project_id, lead_id)
      REFERENCES crm_customers (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'notification_events'::regclass
       AND conname = 'notification_events_project_scope_fkey'
  ) THEN
    ALTER TABLE notification_events
      ADD CONSTRAINT notification_events_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'notification_events'::regclass
       AND conname = 'notification_events_lead_scope_fkey'
  ) THEN
    ALTER TABLE notification_events
      ADD CONSTRAINT notification_events_lead_scope_fkey
      FOREIGN KEY (organization_id, project_id, lead_id)
      REFERENCES crm_customers (organization_id, project_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'webhook_delivery_queue'::regclass
       AND conname = 'webhook_delivery_queue_subscription_scope_fkey'
  ) THEN
    ALTER TABLE webhook_delivery_queue
      ADD CONSTRAINT webhook_delivery_queue_subscription_scope_fkey
      FOREIGN KEY (organization_id, subscription_id)
      REFERENCES leadgrid_webhook_subscriptions (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'webhook_delivery_queue'::regclass
       AND conname = 'webhook_delivery_queue_project_scope_fkey'
  ) THEN
    ALTER TABLE webhook_delivery_queue
      ADD CONSTRAINT webhook_delivery_queue_project_scope_fkey
      FOREIGN KEY (organization_id, project_id)
      REFERENCES leadgrid_projects (organization_id, id)
      ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;
  END IF;
END
$migration$;

-- NOT VALID permits unresolved legacy NULLs, while PostgreSQL still enforces
-- the required-project checks and tuple FKs for every new/updated row.
ALTER TABLE lead_scores_history
  VALIDATE CONSTRAINT lead_scores_history_project_scope_fkey;
ALTER TABLE lead_scores_history
  VALIDATE CONSTRAINT lead_scores_history_lead_scope_fkey;
ALTER TABLE lead_recommendations
  VALIDATE CONSTRAINT lead_recommendations_project_scope_fkey;
ALTER TABLE lead_recommendations
  VALIDATE CONSTRAINT lead_recommendations_lead_scope_fkey;
ALTER TABLE notification_events
  VALIDATE CONSTRAINT notification_events_project_scope_fkey;
ALTER TABLE notification_events
  VALIDATE CONSTRAINT notification_events_lead_scope_fkey;
ALTER TABLE webhook_delivery_queue
  VALIDATE CONSTRAINT webhook_delivery_queue_subscription_scope_fkey;
ALTER TABLE webhook_delivery_queue
  VALIDATE CONSTRAINT webhook_delivery_queue_project_scope_fkey;

CREATE INDEX IF NOT EXISTS idx_lead_scores_history_project_lead_time
  ON lead_scores_history (organization_id, project_id, lead_id, computed_at DESC)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_recommendations_project_active
  ON lead_recommendations
    (organization_id, project_id, assigned_user_id, status, priority, created_at DESC)
  WHERE project_id IS NOT NULL AND status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_lead_recommendations_project_dedupe
  ON lead_recommendations
    (organization_id, project_id, lead_id, action_type, created_at DESC)
  WHERE project_id IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notification_events_project_throttle
  ON notification_events
    (recipient_user_id, organization_id, project_id, lead_id, event_type, created_at DESC)
  WHERE project_id IS NOT NULL AND lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_queue_project_retry
  ON webhook_delivery_queue
    (organization_id, project_id, status, next_retry_at)
  WHERE project_id IS NOT NULL AND status IN ('pending', 'failed');

COMMENT ON COLUMN lead_scores_history.project_id IS
  'Authoritative Leadgrid customer project. NULL is limited to ambiguous pre-0547 legacy history.';
COMMENT ON COLUMN lead_recommendations.project_id IS
  'Authoritative Leadgrid customer project. New rows must be project scoped.';
COMMENT ON COLUMN notification_events.project_id IS
  'Leadgrid project when the event is project-specific; NULL for workspace/global notifications.';
COMMENT ON COLUMN webhook_delivery_queue.organization_id IS
  'Authoritative tenant copied from the referenced Leadgrid webhook subscription.';
COMMENT ON COLUMN webhook_delivery_queue.project_id IS
  'Leadgrid project for project-specific deliveries; NULL for explicitly workspace-wide events.';

COMMIT;
