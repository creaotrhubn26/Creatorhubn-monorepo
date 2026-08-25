-- =====================================================================
-- 314_leadgrid_meeting_notes.sql
--
-- AI Meeting Notes for Leadgrid.
--
-- Voice memo (m4a/wav) → Whisper transcript → Claude extraction →
-- structured action_items / decisions / next_steps / topics. Knyttet til
-- crm_customers (lead) + org + bruker. Auto-logger til
-- crm_lead_activities slik at meeting-recap blir synlig i lead-feeden.
--
-- Permissions:
--   meeting_notes.create   — opprette/laste opp møtenotater
--   meeting_notes.view     — se møtenotater
--   meeting_notes.delete   — slette
-- =====================================================================

BEGIN;

-- ─── Hovedtabell ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('voice_memo','manual','call_transcript','meeting_recap')),
  audio_url TEXT,                   -- B2/S3 URL hvis source = voice_memo
  audio_duration_seconds INTEGER,
  transcript TEXT,                  -- whisper-output
  transcript_language VARCHAR(8),   -- 'no', 'en'
  summary TEXT,                     -- Claude-generated 2-3 setninger
  action_items JSONB,               -- [{title, due_date, priority, assignee}]
  decisions JSONB,                  -- [{decision, owner}]
  next_steps JSONB,                 -- [{step, owner, deadline}]
  topics JSONB,                     -- [{topic, sentiment}]
  participants JSONB,               -- [{name, role}]
  confidence NUMERIC(3,2),          -- 0-1 from Claude
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending','transcribing','analyzing','completed','failed')),
  error_message TEXT,
  raw_claude_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lead_meeting_notes_lead
  ON lead_meeting_notes(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_meeting_notes_status
  ON lead_meeting_notes(processing_status)
  WHERE processing_status IN ('pending','transcribing','analyzing');

-- ─── crm_lead_activities: utvid CHECK med meeting_recap ────────
-- Vi auto-logger fra meeting-notes-service'en, så CHECK må kjenne
-- typen. Idempotent via DROP/ADD.
ALTER TABLE crm_lead_activities
  DROP CONSTRAINT IF EXISTS crm_lead_activities_activity_type_check;

ALTER TABLE crm_lead_activities
  ADD CONSTRAINT crm_lead_activities_activity_type_check
  CHECK (activity_type IN (
    'status_changed','visit_logged','note_added','pitch_generated',
    'meeting_scheduled','proposal_sent','follow_up_set',
    'lead_created','lead_imported','assigned',
    'meeting_recap','action_item_created'
  ));

-- ─── RBAC ──────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('meeting_notes.create', 'meeting_notes', 'Lag møtenotater på lead'),
  ('meeting_notes.view',   'meeting_notes', 'Se møtenotater'),
  ('meeting_notes.delete', 'meeting_notes', 'Slett møtenotater')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category,
      description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin',          'meeting_notes.create'),
  ('admin',          'meeting_notes.view'),
  ('admin',          'meeting_notes.delete'),
  ('salgssjef',      'meeting_notes.create'),
  ('salgssjef',      'meeting_notes.view'),
  ('salgssjef',      'meeting_notes.delete'),
  ('teamleder',      'meeting_notes.create'),
  ('teamleder',      'meeting_notes.view'),
  ('salgskonsulent', 'meeting_notes.create'),
  ('salgskonsulent', 'meeting_notes.view'),
  ('promotor',       'meeting_notes.create'),
  ('promotor',       'meeting_notes.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
