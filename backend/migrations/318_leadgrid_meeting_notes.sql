-- =====================================================================
-- 318_leadgrid_meeting_notes.sql
--
-- AI Meeting Notes — felt-selger gjør voice memo etter besøk → Whisper
-- transkriberer → Claude ekstraherer action items / decisions / next
-- steps / topics → auto-logger crm_lead_activities og oppdaterer NBA.
--
-- Også: seed permission `leadgrid.research.run` for Role Room Agent
-- Bridge (full-intelligence-rapport per lead).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS lead_meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('voice_memo','manual','call_transcript','meeting_recap')),
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  transcript TEXT,
  transcript_language VARCHAR(8),
  summary TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  decisions JSONB DEFAULT '[]'::jsonb,
  next_steps JSONB DEFAULT '[]'::jsonb,
  topics JSONB DEFAULT '[]'::jsonb,
  participants JSONB DEFAULT '[]'::jsonb,
  confidence NUMERIC(3,2),
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
CREATE INDEX IF NOT EXISTS idx_lead_meeting_notes_org
  ON lead_meeting_notes(organization_id, created_at DESC);

-- ─── Permissions ──────────────────────────────────────────────────────
INSERT INTO permissions (key, category, description) VALUES
  ('meeting_notes.create',     'Møtenotater', 'Lag møtenotater på lead'),
  ('meeting_notes.view',       'Møtenotater', 'Se møtenotater'),
  ('meeting_notes.delete',     'Møtenotater', 'Slett møtenotater'),
  ('leadgrid.research.run',    'Leadgrid Research', 'Kjør full Role Room Agent-rapport på en lead')
ON CONFLICT (key) DO UPDATE
  SET category = EXCLUDED.category, description = EXCLUDED.description;

INSERT INTO role_permissions (role, permission_key) VALUES
  ('admin', 'meeting_notes.create'),
  ('admin', 'meeting_notes.view'),
  ('admin', 'meeting_notes.delete'),
  ('admin', 'leadgrid.research.run'),
  ('salgssjef', 'meeting_notes.create'),
  ('salgssjef', 'meeting_notes.view'),
  ('salgssjef', 'meeting_notes.delete'),
  ('salgssjef', 'leadgrid.research.run'),
  ('teamleder', 'meeting_notes.create'),
  ('teamleder', 'meeting_notes.view'),
  ('teamleder', 'leadgrid.research.run'),
  ('salgskonsulent', 'meeting_notes.create'),
  ('salgskonsulent', 'meeting_notes.view'),
  ('salgskonsulent', 'leadgrid.research.run'),
  ('promotor', 'meeting_notes.create'),
  ('promotor', 'meeting_notes.view')
ON CONFLICT (role, permission_key) DO NOTHING;

COMMIT;
