-- Server-owned call-sheet revisions, immutable snapshots and an audit trail.
ALTER TABLE role_room_call_sheet_deliveries
  ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS supersedes_delivery_id UUID REFERENCES role_room_call_sheet_deliveries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retracted_by_user_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Old clients always submitted revision 1. Normalize existing histories before
-- enforcing one deterministic revision sequence and one active publication.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, COALESCE(production_day_id, '')
      ORDER BY created_at ASC, id ASC
    )::integer AS normalized_revision,
    COUNT(*) OVER (
      PARTITION BY project_id, COALESCE(production_day_id, '')
    )::integer AS delivery_count
  FROM role_room_call_sheet_deliveries
)
UPDATE role_room_call_sheet_deliveries AS delivery
SET
  revision = ranked.normalized_revision,
  status = CASE
    WHEN ranked.normalized_revision = ranked.delivery_count THEN 'published'
    ELSE 'superseded'
  END,
  updated_at = NOW()
FROM ranked
WHERE ranked.id = delivery.id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'role_room_call_sheet_deliveries_status_check'
  ) THEN
    ALTER TABLE role_room_call_sheet_deliveries
      ADD CONSTRAINT role_room_call_sheet_deliveries_status_check
      CHECK (status IN ('published', 'superseded', 'retracted'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_call_sheet_delivery_revision
  ON role_room_call_sheet_deliveries(project_id, COALESCE(production_day_id, ''), revision);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_call_sheet_one_published
  ON role_room_call_sheet_deliveries(project_id, COALESCE(production_day_id, ''))
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_supersedes
  ON role_room_call_sheet_deliveries(supersedes_delivery_id);

CREATE TABLE IF NOT EXISTS role_room_call_sheet_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES role_room_call_sheet_deliveries(id) ON DELETE CASCADE,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  production_day_id VARCHAR(255),
  actor_user_id VARCHAR(255),
  recipient_id UUID REFERENCES role_room_call_sheet_recipients(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_events_delivery
  ON role_room_call_sheet_events(delivery_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rr_call_sheet_events_project_day
  ON role_room_call_sheet_events(project_id, production_day_id, created_at DESC);
