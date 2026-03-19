-- Role Room Google Workspace layer
-- Optional Google auth, Drive, Calendar, Meet and artifact sync for Role Room only.

CREATE TABLE IF NOT EXISTS role_room_google_connections (
  id UUID PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  role_room_email VARCHAR(255),
  google_email VARCHAR(255),
  google_subject VARCHAR(255),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expiry_date TIMESTAMPTZ,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  connection_state VARCHAR(32) NOT NULL DEFAULT 'disconnected',
  last_error TEXT,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_user_id_unique ON role_room_google_connections(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_connections_subject_unique ON role_room_google_connections(google_subject);
CREATE INDEX IF NOT EXISTS idx_rr_google_connections_email ON role_room_google_connections(google_email);

CREATE TABLE IF NOT EXISTS role_room_google_project_bindings (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  connected_user_id VARCHAR(255),
  drive_root_folder_id VARCHAR(255),
  calendar_id VARCHAR(255),
  contacts_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  meet_creation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  audit_signature_storage_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  folder_layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  sync_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_drive_sync_at TIMESTAMPTZ,
  last_calendar_sync_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_project_binding_project_unique ON role_room_google_project_bindings(project_id);

CREATE TABLE IF NOT EXISTS role_room_google_artifacts (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  local_entity_type VARCHAR(100) NOT NULL,
  local_entity_id VARCHAR(255) NOT NULL,
  artifact_type VARCHAR(64) NOT NULL,
  source_label VARCHAR(255),
  drive_file_id VARCHAR(255),
  calendar_event_id VARCHAR(255),
  meet_url TEXT,
  web_view_url TEXT,
  web_content_link TEXT,
  mime_type VARCHAR(255),
  folder_key VARCHAR(64),
  sync_status VARCHAR(32) NOT NULL DEFAULT 'synced',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rr_google_artifact_local_unique
  ON role_room_google_artifacts(project_id, local_entity_type, local_entity_id, artifact_type);
CREATE INDEX IF NOT EXISTS idx_rr_google_artifacts_project ON role_room_google_artifacts(project_id);
CREATE INDEX IF NOT EXISTS idx_rr_google_artifacts_drive_file ON role_room_google_artifacts(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_rr_google_artifacts_calendar_event ON role_room_google_artifacts(calendar_event_id);
