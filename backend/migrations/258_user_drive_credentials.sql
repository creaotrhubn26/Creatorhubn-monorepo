-- 258_user_drive_credentials.sql
--
-- Per-bruker Google Drive-credentials for CreatorHub-skapere
-- (fotografer/videograf/eventplanleggere/etc.). Parallelt med user_b2_*
-- (migrasjon 256/257) — brukere kan velge B2, Drive eller BEGGE.
--
-- Sikkerhetsmodell:
--   * refresh_token / access_token krypteres AES-256-GCM med per-bruker
--     HKDF-derivert KEK fra STORAGE_MASTER_KEK_HEX (samme mønster som
--     user-b2-credentials-routes.ts → file-encryption.ts)
--   * IV (12 byte) lagres separat for hver ciphertext for revisjon
--   * UNIQUE (user_id) — én aktiv Drive-credential per bruker
--   * is_verified flippes til TRUE først etter at en faktisk
--     Drive API-call (about.get / files.list på root) lykkes
--
-- Scope-strategi:
--   * 'drive.file' (default, anbefalt) — Drive API gir KUN tilgang
--     til filer/mapper som er opprettet av VÅR app. Vi kan ikke se
--     andre filer i brukerens Drive. Lavest mulig surface.
--   * 'drive' (opt-in) — full Drive-tilgang. Trengs hvis brukeren
--     vil at vi skal sync'e en EKSISTERENDE mappe de allerede har
--     i Drive. Krever Google App Verification.

CREATE TABLE IF NOT EXISTS user_drive_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
    -- Én aktiv Drive-credential per bruker (oppdateres in-place)
  google_account_email TEXT NOT NULL,
    -- E-postadressen til Google-kontoen — klartext, ikke sensitiv
  refresh_token_encrypted TEXT NOT NULL,
    -- AES-256-GCM cipher av refresh_token (base64: iv||tag||ciphertext)
  refresh_token_iv TEXT NOT NULL,
    -- IV brukt til kryptering (lagres separat for revisjon)
  access_token_encrypted TEXT,
    -- Cached access_token — bytes ut ved refresh, kan være NULL
  access_token_iv TEXT,
  access_token_expires_at TIMESTAMPTZ,
    -- Når access_token ikke lenger gyldig. Buffer på 60 sek brukes
    -- når helperen sjekker om refresh trengs.
  root_folder_id TEXT,
    -- ID til hovedmappen i bruker's Drive (typisk "CreatorHub Workspace")
  root_folder_name TEXT NOT NULL DEFAULT 'CreatorHub Workspace',
  scope_granted TEXT NOT NULL DEFAULT 'drive.file',
    -- 'drive.file' (kun mapper vi lager) eller 'drive' (full tilgang)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE etter at vi har gjort en test-call (Drive about.get)
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  storage_quota_total_bytes BIGINT,
    -- Total quota fra Drive about.get — cached 1 t
  storage_quota_used_bytes BIGINT,
  storage_quota_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_drive_credentials_user_idx
  ON user_drive_credentials (user_id);

CREATE INDEX IF NOT EXISTS user_drive_credentials_active_idx
  ON user_drive_credentials (user_id) WHERE is_active = TRUE;

-- ───────────────────────────────────────────────────────────────────
-- Mappestruktur — cache av Drive folder-IDs etter setup-folders
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_drive_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  drive_folder_id TEXT NOT NULL,
    -- Google Drive sin folder-ID
  parent_drive_folder_id TEXT,
    -- NULL kun for rotmappen
  folder_path TEXT NOT NULL,
    -- F.eks. 'Galleries/2026-06' — relativ til root_folder_id
  folder_name TEXT NOT NULL,
  template_key TEXT,
    -- F.eks. 'photographer-default' (peker til FOLDER_TEMPLATES-entry)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, folder_path)
);

CREATE INDEX IF NOT EXISTS user_drive_folders_user_idx
  ON user_drive_folders (user_id);
CREATE INDEX IF NOT EXISTS user_drive_folders_parent_idx
  ON user_drive_folders (user_id, parent_drive_folder_id);

-- ───────────────────────────────────────────────────────────────────
-- Filer i Drive — parallelt med user_b2_files. Trackes via sync-worker.
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  drive_file_id TEXT NOT NULL,
    -- Google Drive sin file-ID
  drive_folder_id TEXT,
    -- Parent folder (kan være null hvis i root)
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  source TEXT,
    -- 'gallery' | 'post-agent' | 'role-room' | 'direct-upload' | 'drive-sync'
  source_id TEXT,
    -- ID til relatert objekt (gallery_id, project_id, etc.)
  web_view_link TEXT,
    -- Drive webViewLink for å vise i ny tab
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, drive_file_id)
);

CREATE INDEX IF NOT EXISTS user_drive_files_user_idx
  ON user_drive_files (user_id, uploaded_at DESC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS user_drive_files_source_idx
  ON user_drive_files (source, source_id);
CREATE INDEX IF NOT EXISTS user_drive_files_folder_idx
  ON user_drive_files (user_id, drive_folder_id)
  WHERE is_deleted = FALSE;

-- ───────────────────────────────────────────────────────────────────
-- Sync-runs — historie / status for sync-worker
-- ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_drive_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
    -- 'running' | 'success' | 'failed'
  files_seen INTEGER NOT NULL DEFAULT 0,
  files_added INTEGER NOT NULL DEFAULT 0,
  files_marked_deleted INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS user_drive_sync_runs_user_idx
  ON user_drive_sync_runs (user_id, started_at DESC);
