-- Proactive client updates: a producer-initiated "here's what we published and
-- how it's doing" summary, emailed to the client and shown in their portal.
-- Closes the gap where Role Room could collect client *approvals* but never
-- proactively *updated* the client on plan execution + performance.

CREATE TABLE IF NOT EXISTS role_room_client_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  plan_id UUID,
  period_label TEXT NOT NULL,
  -- The full rendered digest (headline, highlights, best-time tip, counts) so
  -- the portal and any re-render use exactly what the client was emailed.
  digest JSONB NOT NULL DEFAULT '{}'::jsonb,
  producer_note TEXT,
  sent_by UUID,                       -- producer user id who triggered it
  recipients_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_room_client_updates_project_idx
  ON role_room_client_updates (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS role_room_client_updates_plan_idx
  ON role_room_client_updates (plan_id, created_at DESC)
  WHERE plan_id IS NOT NULL;
