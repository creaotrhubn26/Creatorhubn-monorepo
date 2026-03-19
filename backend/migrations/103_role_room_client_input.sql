-- Role Room client brief and submitted materials
-- Keeps client-facing input in the same project space as producer workflow.

CREATE TABLE IF NOT EXISTS role_room_client_intake (
  project_id VARCHAR(255) PRIMARY KEY REFERENCES casting_projects(id) ON DELETE CASCADE,
  project_goal TEXT,
  deliverables TEXT,
  target_audience TEXT,
  key_message TEXT,
  timing_constraints TEXT,
  brand_notes TEXT,
  material_overview TEXT,
  reference_links TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  additional_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_by_user_id TEXT,
  updated_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_room_client_materials (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  external_url TEXT,
  phase TEXT,
  linked_shot_list_id TEXT,
  status TEXT DEFAULT 'provided',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_user_id TEXT,
  created_by_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rr_client_materials_project ON role_room_client_materials(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_client_materials_phase ON role_room_client_materials(phase);
