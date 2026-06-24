-- 326_leadgrid_snooze_and_stage_change.sql
--
-- Låser opp iPad-features:
--   1) 24h-snooze på NBA-anbefalinger (lead_recommendations)
--   2) Drag-and-drop på Kanban (audit på crm_customers.pipeline_stage)
--
-- Backend-handlere i leadgrid-intelligence-routes.ts:
--   - POST /api/leadgrid/intelligence/recommendations/:id/snooze
--   - PATCH /api/leadgrid/intelligence/leads/:id/pipeline-stage
--
-- Webhook-events:
--   - recommendation.snoozed
--   - lead.pipeline_stage_changed

BEGIN;

-- ── Snooze på recommendations ──────────────────────────────────────
ALTER TABLE lead_recommendations
  ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snoozed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS snoozed_by_user_id VARCHAR(255);

-- ── Audit-trail for stage-changes (drag-and-drop på Kanban) ────────
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS last_pipeline_stage_change_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_pipeline_stage_change_by VARCHAR(255);

-- ── Indeks for snoozed-filter på follow-up-queue ───────────────────
CREATE INDEX IF NOT EXISTS idx_lead_recs_active_or_snoozed
  ON lead_recommendations(organization_id, snoozed_until)
  WHERE status = 'pending';

-- ── Nye webhook-events ─────────────────────────────────────────────
INSERT INTO webhook_event_types (event_key, description) VALUES
  ('recommendation.snoozed', 'NBA-anbefaling snoozed av bruker'),
  ('lead.pipeline_stage_changed', 'Lead manuelt flyttet til ny pipeline-stage')
ON CONFLICT (event_key) DO NOTHING;

COMMIT;
