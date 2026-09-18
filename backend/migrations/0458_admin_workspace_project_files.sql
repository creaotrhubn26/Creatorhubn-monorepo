-- 0458_admin_workspace_project_files.sql
--
-- Prosjektomfattende kunnskapsfiler for Admin Workspace. En fil tilhører
-- alltid én tenant og ett adminprosjekt. Dokumenter får tilgang når de er
-- koblet til prosjektet via admin_document_links (workspace_project).

CREATE TABLE IF NOT EXISTS admin_workspace_project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(160),
  file_size BIGINT NOT NULL,
  file_data BYTEA NOT NULL,
  sha256 VARCHAR(64) NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  context_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  extraction_method VARCHAR(60),
  extraction_error VARCHAR(500),
  extraction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_workspace_project_files_user_unique UNIQUE (id, user_id),
  CONSTRAINT admin_workspace_project_files_project_fk
    FOREIGN KEY (project_id, user_id)
    REFERENCES admin_workspace_projects (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_workspace_project_files_project_hash_unique
    UNIQUE (project_id, sha256),
  CONSTRAINT admin_workspace_project_files_size_check
    CHECK (file_size > 0 AND file_size <= 15728640),
  CONSTRAINT admin_workspace_project_files_version_check
    CHECK (version_no >= 1),
  CONSTRAINT admin_workspace_project_files_extraction_status_check
    CHECK (extraction_status IN ('pending', 'processing', 'ready', 'failed', 'unsupported'))
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_project_files_project
  ON admin_workspace_project_files (user_id, project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_project_files_context
  ON admin_workspace_project_files (user_id, project_id, extraction_status)
  WHERE context_enabled = TRUE;

CREATE TABLE IF NOT EXISTS admin_workspace_project_file_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_file_id UUID NOT NULL,
  project_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  chunk_index INTEGER NOT NULL,
  section_label VARCHAR(255),
  page_number INTEGER,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_workspace_project_file_chunks_file_fk
    FOREIGN KEY (project_file_id, user_id)
    REFERENCES admin_workspace_project_files (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_workspace_project_file_chunks_project_fk
    FOREIGN KEY (project_id, user_id)
    REFERENCES admin_workspace_projects (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_workspace_project_file_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT admin_workspace_project_file_chunks_page_check
    CHECK (page_number IS NULL OR page_number >= 1),
  CONSTRAINT admin_workspace_project_file_chunks_content_check
    CHECK (char_length(content) BETWEEN 1 AND 12000),
  CONSTRAINT admin_workspace_project_file_chunks_unique
    UNIQUE (project_file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_project_file_chunks_file
  ON admin_workspace_project_file_chunks (user_id, project_file_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_admin_workspace_project_file_chunks_search
  ON admin_workspace_project_file_chunks
  USING GIN (to_tsvector('simple', COALESCE(section_label, '') || ' ' || content));

CREATE TABLE IF NOT EXISTS admin_document_project_file_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  project_file_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_project_file_preferences_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_project_file_preferences_file_fk
    FOREIGN KEY (project_file_id, user_id)
    REFERENCES admin_workspace_project_files (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_project_file_preferences_unique
    UNIQUE (document_id, project_file_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_document_project_file_preferences_document
  ON admin_document_project_file_preferences (user_id, document_id, project_file_id);

ALTER TABLE admin_document_context_usages
  ADD COLUMN IF NOT EXISTS source_project_file_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_document_context_usages_source_project_file_fk'
  ) THEN
    ALTER TABLE admin_document_context_usages
      ADD CONSTRAINT admin_document_context_usages_source_project_file_fk
      FOREIGN KEY (source_project_file_id, user_id)
      REFERENCES admin_workspace_project_files (id, user_id)
      ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE admin_document_context_usages
  DROP CONSTRAINT IF EXISTS admin_document_context_usages_source_check;

ALTER TABLE admin_document_context_usages
  ADD CONSTRAINT admin_document_context_usages_source_check
  CHECK (
    source_document_id IS NOT NULL
    OR source_file_id IS NOT NULL
    OR source_project_file_id IS NOT NULL
  );

COMMENT ON TABLE admin_workspace_project_files IS
  'Tenant-eide filer som er felles kunnskapskilder for dokumenter koblet til et adminprosjekt.';

COMMENT ON TABLE admin_document_project_file_preferences IS
  'Dokumentspesifikke av/på-overstyringer for prosjektfiler som ellers er aktive automatisk.';
