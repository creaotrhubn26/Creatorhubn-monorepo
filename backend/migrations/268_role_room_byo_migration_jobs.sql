-- =====================================================================
-- 268_role_room_byo_migration_jobs.sql
--
-- L3b — BYO B2 + 1-klikks migrate.
--
-- Når en bruker kobler sin egen Backblaze B2 (via eksisterende
-- user_b2_credentials, migrasjon 256), kan de starte en migrate-jobb
-- som flytter alle eksisterende filer fra admin-B2 (the-role-room-prod)
-- til deres egen B2.
--
-- Migrate-jobben kjører i bakgrunnen og rapporterer progress mot denne
-- tabellen (UI poller /status hvert 2s).
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS role_room_byo_migration_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Retning: 'to_byo' = admin-B2 → user-B2, 'from_byo' = user-B2 → admin-B2
  direction TEXT NOT NULL CHECK (direction IN ('to_byo', 'from_byo')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'completed', 'failed', 'partial', 'cancelled'
  )),
  -- Pre-flight oppsummering — fylles inn ved jobbstart
  total_files INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  -- Progress (incremental update fra worker)
  files_completed INTEGER NOT NULL DEFAULT 0,
  files_failed INTEGER NOT NULL DEFAULT 0,
  bytes_completed BIGINT NOT NULL DEFAULT 0,
  -- Feilrapport — JSONB av { fileId, b2Key, error }-objekter, capped ved 50
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  -- Notater fra worker (siste melding)
  status_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bare én aktiv migrasjon per bruker av gangen
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_room_byo_migration_active
  ON role_room_byo_migration_jobs(user_id)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_role_room_byo_migration_user_recent
  ON role_room_byo_migration_jobs(user_id, created_at DESC);

COMMIT;
