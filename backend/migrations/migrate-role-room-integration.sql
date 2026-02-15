-- ============================================================
-- Role Room ↔ Creatorhub Integration Migration
-- Adds integration columns to existing casting tables +
-- creates new sync/API tables
-- ============================================================

-- Auto-update trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Add integration columns to existing casting_projects ─────

ALTER TABLE casting_projects
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS genre VARCHAR(100),
  ADD COLUMN IF NOT EXISTS project_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS budget NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NOK',
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS creatorhub_project_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS casting_projects_created_by_idx ON casting_projects (created_by);
CREATE INDEX IF NOT EXISTS casting_projects_status_idx ON casting_projects (status);
CREATE INDEX IF NOT EXISTS casting_projects_creatorhub_project_id_idx ON casting_projects (creatorhub_project_id);

-- ── Ensure casting_user_roles has the needed columns ─────────

ALTER TABLE casting_user_roles
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS added_by VARCHAR(255);

CREATE INDEX IF NOT EXISTS casting_user_roles_user_id_idx ON casting_user_roles (user_id);

-- ── Ensure casting_candidates has integration columns ────────

ALTER TABLE casting_candidates
  ADD COLUMN IF NOT EXISTS agency VARCHAR(255),
  ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS videos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS assigned_roles JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS rating INTEGER,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS emergency_contact JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS consent_status VARCHAR(50);

-- ── Ensure casting_roles has integration columns ─────────────

ALTER TABLE casting_roles
  ADD COLUMN IF NOT EXISTS age_range VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(50),
  ADD COLUMN IF NOT EXISTS ethnicity VARCHAR(100),
  ADD COLUMN IF NOT EXISTS role_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS scene_ids JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_candidate_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS candidate_ids JSONB DEFAULT '[]';

-- ── Project Sync Log (Creatorhub ↔ Role Room) ───────────────

CREATE TABLE IF NOT EXISTS casting_project_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  creatorhub_project_id VARCHAR(255) NOT NULL,
  casting_project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  sync_direction VARCHAR(20) NOT NULL,
  sync_status VARCHAR(20) DEFAULT 'pending',
  sync_data JSONB DEFAULT '{}',
  error_message TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_project_sync_creatorhub_idx ON casting_project_sync (creatorhub_project_id);
CREATE INDEX IF NOT EXISTS casting_project_sync_casting_idx ON casting_project_sync (casting_project_id);

-- ── API Key Management ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_room_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  name VARCHAR(255) NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  scopes JSONB DEFAULT '["read"]',
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_api_keys_hash_unique ON role_room_api_keys (key_hash);
CREATE INDEX IF NOT EXISTS role_room_api_keys_user_id_idx ON role_room_api_keys (user_id);

-- ── Marketplace Installation Tracking ────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_installations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY NOT NULL,
  user_id VARCHAR(255) NOT NULL,
  app_id VARCHAR(100) NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  UNIQUE(user_id, app_id)
);

-- ══════════════════════════════════════════════════════════════
-- Done! Role Room integration tables are ready in Creatorhub.
-- ══════════════════════════════════════════════════════════════
