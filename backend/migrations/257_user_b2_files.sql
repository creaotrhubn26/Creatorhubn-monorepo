-- 257_user_b2_files.sql
--
-- Tracker hvilke filer brukeren har i sin B2-bucket. Vi får ikke webhook
-- fra Backblaze så vi må selv vedlikeholde dette. Vi inserter ved upload
-- via vår signed-URL + periodisk sync-job som lister bucketen.
--
-- Mønster:
--   * /api/user/b2-credentials/upload-url → klient PUTer mot B2
--   * klient kaller /api/user/b2-credentials/files/register → INSERT her
--   * sync-worker (hver 6. time) lister bucketen og bumper last_seen_at
--   * filer som ikke er sett på 30 dager antas slettet manuelt i B2

CREATE TABLE IF NOT EXISTS user_b2_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  content_type TEXT,
  source TEXT,
    -- 'gallery' | 'post-agent' | 'role-room' | 'direct-upload' | 'b2-sync'
  source_id TEXT,
    -- ID til relatert objekt (gallery_id, project_id, etc.)
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Oppdateres av sync-job — hvis ikke sett i 30 dager, antas slettet manuelt
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE (user_id, file_key)
);

CREATE INDEX IF NOT EXISTS user_b2_files_user_idx
  ON user_b2_files (user_id, uploaded_at DESC)
  WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS user_b2_files_source_idx
  ON user_b2_files (source, source_id);

CREATE TABLE IF NOT EXISTS user_b2_sync_runs (
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

CREATE INDEX IF NOT EXISTS user_b2_sync_runs_user_idx
  ON user_b2_sync_runs (user_id, started_at DESC);
