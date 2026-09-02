-- =====================================================================
-- 0490_leadgrid_core_dataflow.sql
--
-- Durable, organization-scoped persistence for the Leadgrid surfaces that
-- previously lived only in UserDefaults or discarded their form values.
-- The migration is additive and safe to re-run.
-- =====================================================================

BEGIN;

-- A visit is also Leadgrid's canonical logged interaction. Preserve the
-- exact UI activity/outcome in addition to the existing transport category.
ALTER TABLE crm_visits
  ADD COLUMN IF NOT EXISTS activity_kind VARCHAR(30),
  ADD COLUMN IF NOT EXISTS outcome VARCHAR(30),
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'crm_visits'::regclass
      AND conname = 'crm_visits_activity_kind_check'
  ) THEN
    ALTER TABLE crm_visits ADD CONSTRAINT crm_visits_activity_kind_check
      CHECK (activity_kind IS NULL OR activity_kind IN (
        'call','email','meeting','note','visit','demo','proposal','deal_close'
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'crm_visits'::regclass
      AND conname = 'crm_visits_outcome_check'
  ) THEN
    ALTER TABLE crm_visits ADD CONSTRAINT crm_visits_outcome_check
      CHECK (outcome IS NULL OR outcome IN (
        'no_answer','spoke','meeting_booked','proposal_sent',
        'interested','not_interested','won','lost'
      ));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'crm_visits'::regclass
      AND conname = 'crm_visits_duration_minutes_check'
  ) THEN
    ALTER TABLE crm_visits ADD CONSTRAINT crm_visits_duration_minutes_check
      CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440);
  END IF;
END$$;

-- Calendar meetings are derived from crm_customers. Persist their duration
-- beside next_follow_up_at so edits survive refreshes and other devices.
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS meeting_duration_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS meeting_status VARCHAR(30) NOT NULL DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'crm_customers'::regclass
      AND conname = 'crm_customers_meeting_duration_minutes_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_meeting_duration_minutes_check
      CHECK (meeting_duration_minutes BETWEEN 15 AND 720);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'crm_customers'::regclass
      AND conname = 'crm_customers_meeting_status_check'
  ) THEN
    ALTER TABLE crm_customers
      ADD CONSTRAINT crm_customers_meeting_status_check
      CHECK (meeting_status IN ('confirmed','on_the_way','follow_up','pending','cancelled'));
  END IF;
END$$;

-- Team-visible notes. They belong to an organization and a lead, while the
-- author is retained for attribution and may be removed independently.
CREATE TABLE IF NOT EXISTS leadgrid_lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  author_user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 20000),
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_notes_feed
  ON leadgrid_lead_notes (organization_id, lead_id, pinned DESC, created_at DESC)
  WHERE deleted_at IS NULL;

-- Favorites are personal presentation state, but still tenant-bound so a
-- stale lead UUID from another workspace can never be persisted or returned.
CREATE TABLE IF NOT EXISTS leadgrid_lead_favorites (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, lead_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_lead_favorites_user
  ON leadgrid_lead_favorites (organization_id, user_id, created_at DESC);

-- Manual competitors need an explicit workspace owner. Rows imported from a
-- scan/project can be backfilled deterministically; unknown legacy rows remain
-- nullable and continue through the legacy owner_user_id fallback.
ALTER TABLE market_scan_competitors
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

UPDATE market_scan_competitors c
   SET organization_id = COALESCE(
     (SELECT s.organization_id FROM market_scans s WHERE s.id = c.market_scan_id),
     (SELECT p.organization_id FROM leadgrid_projects p WHERE p.id = c.project_id)
   )
 WHERE c.organization_id IS NULL
   AND (
     EXISTS (SELECT 1 FROM market_scans s WHERE s.id = c.market_scan_id AND s.organization_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM leadgrid_projects p WHERE p.id = c.project_id AND p.organization_id IS NOT NULL)
   );

CREATE INDEX IF NOT EXISTS idx_market_scan_competitors_organization
  ON market_scan_competitors (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- Finalizing a pitch presentation must be replay-safe. The stored result
-- lets a retried client receive the original applied actions without running them twice.
ALTER TABLE pitch_deck_presentations
  ADD COLUMN IF NOT EXISTS outcome_applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome_applied JSONB;

-- Workflow task actions already write activity_type='task'. The original
-- migration's CHECK did not permit it, so the write silently failed.
ALTER TABLE crm_lead_activities
  DROP CONSTRAINT IF EXISTS crm_lead_activities_activity_type_check;

ALTER TABLE crm_lead_activities
  ADD CONSTRAINT crm_lead_activities_activity_type_check CHECK (activity_type IN (
    'status_changed','visit_logged','note_added','pitch_generated',
    'meeting_scheduled','proposal_sent','follow_up_set',
    'lead_created','lead_imported','assigned','task','pitch_outcome'
  ));

COMMIT;
