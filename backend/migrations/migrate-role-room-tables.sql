-- ============================================================
-- Role Room (Casting System) → Creatorhub Database Migration
-- Creates all casting tables in the Creatorhub Neon database
-- ============================================================

-- Auto-update trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Core: casting_projects ───────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_projects (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_by VARCHAR(255),
  genre VARCHAR(100),
  project_type VARCHAR(100),
  start_date DATE,
  end_date DATE,
  budget NUMERIC(12, 2),
  currency VARCHAR(10) DEFAULT 'NOK',
  settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  creatorhub_project_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_projects_created_by_idx ON casting_projects (created_by);
CREATE INDEX IF NOT EXISTS casting_projects_status_idx ON casting_projects (status);
CREATE INDEX IF NOT EXISTS casting_projects_creatorhub_project_id_idx ON casting_projects (creatorhub_project_id);

DROP TRIGGER IF EXISTS update_casting_projects_updated_at ON casting_projects;
CREATE TRIGGER update_casting_projects_updated_at
  BEFORE UPDATE ON casting_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── casting_roles ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_roles (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  age_range VARCHAR(50),
  gender VARCHAR(50),
  ethnicity VARCHAR(100),
  role_type VARCHAR(100),
  scene_ids JSONB DEFAULT '[]',
  requirements JSONB DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'open',
  assigned_candidate_id VARCHAR(255),
  candidate_ids JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_roles_project_id_idx ON casting_roles (project_id);

DROP TRIGGER IF EXISTS update_casting_roles_updated_at ON casting_roles;
CREATE TRIGGER update_casting_roles_updated_at
  BEFORE UPDATE ON casting_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── casting_candidates ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_candidates (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  agency VARCHAR(255),
  photos JSONB DEFAULT '[]',
  videos JSONB DEFAULT '[]',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  assigned_roles JSONB DEFAULT '[]',
  rating INTEGER,
  metadata JSONB DEFAULT '{}',
  emergency_contact JSONB DEFAULT '{}',
  consent_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_candidates_project_id_idx ON casting_candidates (project_id);

DROP TRIGGER IF EXISTS update_casting_candidates_updated_at ON casting_candidates;
CREATE TRIGGER update_casting_candidates_updated_at
  BEFORE UPDATE ON casting_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── casting_schedules ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_schedules (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  candidate_id VARCHAR(255),
  role_id VARCHAR(255),
  scene_id VARCHAR(255),
  location_id VARCHAR(255),
  date DATE,
  start_time VARCHAR(10),
  end_time VARCHAR(10),
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_schedules_project_id_idx ON casting_schedules (project_id);

-- ── casting_crew ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_crew (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  department VARCHAR(100),
  rate NUMERIC(10, 2),
  availability JSONB DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_crew_project_id_idx ON casting_crew (project_id);

-- ── casting_locations ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_locations (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  coordinates JSONB,
  type VARCHAR(100),
  contact_info JSONB DEFAULT '{}',
  access_notes TEXT,
  photos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_locations_project_id_idx ON casting_locations (project_id);

-- ── casting_props ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_props (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  description TEXT,
  images JSONB DEFAULT '[]',
  availability VARCHAR(50) DEFAULT 'available',
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_props_project_id_idx ON casting_props (project_id);

-- ── casting_production_days ──────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_production_days (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  scene_ids JSONB DEFAULT '[]',
  crew_ids JSONB DEFAULT '[]',
  location_id VARCHAR(255),
  prop_ids JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'planned',
  notes TEXT,
  weather_forecast JSONB,
  audit_log JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_production_days_project_id_idx ON casting_production_days (project_id);

-- ── casting_shot_lists ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_shot_lists (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  scene_id VARCHAR(255),
  shots JSONB DEFAULT '[]',
  camera_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_shot_lists_project_id_idx ON casting_shot_lists (project_id);

-- ── casting_user_roles (RBAC) ────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_user_roles (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  permissions JSONB DEFAULT '{}',
  added_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS casting_user_roles_user_id_idx ON casting_user_roles (user_id);

-- ── casting_consents ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_consents (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  candidate_id VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending',
  signature_data TEXT,
  access_code VARCHAR(20),
  pin VARCHAR(10),
  expires_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_consents_project_id_idx ON casting_consents (project_id);
CREATE INDEX IF NOT EXISTS casting_consents_candidate_id_idx ON casting_consents (candidate_id);

-- ── casting_manuscripts ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_manuscripts (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  format VARCHAR(50),
  content TEXT,
  version INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'draft',
  locked_by VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_manuscripts_project_id_idx ON casting_manuscripts (project_id);

-- ── casting_scenes ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS casting_scenes (
  id VARCHAR(255) PRIMARY KEY NOT NULL,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  manuscript_id VARCHAR(255) REFERENCES casting_manuscripts(id),
  act_id VARCHAR(255),
  scene_number INTEGER,
  title VARCHAR(255),
  description TEXT,
  setting VARCHAR(255),
  time_of_day VARCHAR(50),
  int_ext VARCHAR(20),
  characters JSONB DEFAULT '[]',
  production_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS casting_scenes_project_id_idx ON casting_scenes (project_id);
CREATE INDEX IF NOT EXISTS casting_scenes_manuscript_id_idx ON casting_scenes (manuscript_id);

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
-- Done! All Role Room tables are now in the Creatorhub database.
-- ══════════════════════════════════════════════════════════════
