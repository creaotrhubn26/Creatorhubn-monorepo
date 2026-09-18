-- 0457_admin_document_context.sql
--
-- Kildebasert skrivekontekst for Admin Workspace. Kilder kobles eksplisitt
-- til et måldokument, og opplastede filer indekseres i tenant-eide utdrag.

ALTER TABLE admin_document_files
  ADD COLUMN IF NOT EXISTS context_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(80),
  ADD COLUMN IF NOT EXISTS extraction_error VARCHAR(500),
  ADD COLUMN IF NOT EXISTS extraction_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;

UPDATE admin_document_files
   SET extraction_status = 'external',
       context_enabled = FALSE
 WHERE source_kind IN ('google_drive', 'external')
   AND extraction_status = 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_document_files_user_unique'
  ) THEN
    ALTER TABLE admin_document_files
      ADD CONSTRAINT admin_document_files_user_unique UNIQUE (id, user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'admin_document_files_extraction_status_check'
  ) THEN
    ALTER TABLE admin_document_files
      ADD CONSTRAINT admin_document_files_extraction_status_check
      CHECK (extraction_status IN (
        'pending', 'processing', 'ready', 'failed', 'unsupported', 'external'
      ));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS admin_document_context_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  source_document_id UUID,
  source_file_id UUID,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_context_sources_target_fk
    FOREIGN KEY (target_document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_sources_document_fk
    FOREIGN KEY (source_document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_sources_file_fk
    FOREIGN KEY (source_file_id, user_id)
    REFERENCES admin_document_files (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_sources_exactly_one_check
    CHECK ((source_document_id IS NOT NULL) <> (source_file_id IS NOT NULL)),
  CONSTRAINT admin_document_context_sources_not_self_check
    CHECK (source_document_id IS NULL OR source_document_id <> target_document_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_document_context_source_document_unique
  ON admin_document_context_sources (target_document_id, source_document_id)
  WHERE source_document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_document_context_source_file_unique
  ON admin_document_context_sources (target_document_id, source_file_id)
  WHERE source_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_admin_document_context_sources_target
  ON admin_document_context_sources (user_id, target_document_id, created_at DESC)
  WHERE enabled = TRUE;

CREATE TABLE IF NOT EXISTS admin_document_context_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  chunk_index INTEGER NOT NULL,
  section_label VARCHAR(255),
  page_number INTEGER,
  content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_context_chunks_file_fk
    FOREIGN KEY (file_id, user_id)
    REFERENCES admin_document_files (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_chunks_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_chunks_index_check CHECK (chunk_index >= 0),
  CONSTRAINT admin_document_context_chunks_page_check CHECK (page_number IS NULL OR page_number >= 1),
  CONSTRAINT admin_document_context_chunks_content_check
    CHECK (char_length(content) BETWEEN 1 AND 12000),
  CONSTRAINT admin_document_context_chunks_unique UNIQUE (file_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_admin_document_context_chunks_tenant_file
  ON admin_document_context_chunks (user_id, file_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_admin_document_context_chunks_search
  ON admin_document_context_chunks
  USING GIN (to_tsvector('simple', COALESCE(section_label, '') || ' ' || content));

CREATE TABLE IF NOT EXISTS admin_document_context_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  user_id VARCHAR NOT NULL,
  source_document_id UUID,
  source_file_id UUID,
  source_title VARCHAR(255) NOT NULL,
  suggestion_id VARCHAR(64) NOT NULL,
  insert_mode VARCHAR(20) NOT NULL,
  inserted_text_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_document_context_usages_document_fk
    FOREIGN KEY (document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_usages_source_document_fk
    FOREIGN KEY (source_document_id, user_id)
    REFERENCES admin_documents (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_usages_source_file_fk
    FOREIGN KEY (source_file_id, user_id)
    REFERENCES admin_document_files (id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT admin_document_context_usages_source_check
    CHECK (source_document_id IS NOT NULL OR source_file_id IS NOT NULL),
  CONSTRAINT admin_document_context_usages_mode_check
    CHECK (insert_mode IN ('text', 'bullets', 'source_card'))
);

CREATE INDEX IF NOT EXISTS idx_admin_document_context_usages_document
  ON admin_document_context_usages (user_id, document_id, created_at DESC);

COMMENT ON TABLE admin_document_context_sources IS
  'Eksplisitte, tenant-eide dokument- og filkilder som kan brukes i et måldokument.';

COMMENT ON TABLE admin_document_context_chunks IS
  'Sporbare tekstutdrag fra opplastede filer, brukt til lokal kontekstrangering.';

COMMENT ON TABLE admin_document_context_usages IS
  'Provenienslogg for kildebasert tekst som brukeren aktivt setter inn.';
