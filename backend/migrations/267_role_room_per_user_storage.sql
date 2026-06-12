-- =====================================================================
-- 267_role_room_per_user_storage.sql
--
-- L3a + L3c — Per-bruker storage på admin-B2 (1 GB free-tier).
--
-- Hver bruker av The Role Room får automatisk en prefiks i den sentralt
-- managed `the-role-room-prod`-bucket-en (eu-central-003). Prefikset er
-- `users/{user_id}/...` og brukerkvoter trackes per bruker.
--
-- Default-tier: 1 GB = 1_073_741_824 bytes
--
-- Senere kan vi bygge L3b (BYO B2) som lar power-users koble egen B2 og
-- migrere data ut. Da settes `tier` til 'byo' og kvoten bumpes til ∞
-- (eller settes til 0 hvis vi vil tvinge sletting fra admin-B2).
-- =====================================================================

BEGIN;

-- Bucket-allokering per bruker.
-- Én rad per bruker — opprettes lazy ved første upload eller eksplisitt
-- via /storage/init-route.
CREATE TABLE IF NOT EXISTS role_room_user_buckets (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- Logisk bucket-path i the-role-room-prod (alltid 'users/{user_id}/')
  bucket_prefix TEXT NOT NULL,
  -- Tier-navn — 'free' (1 GB), 'paid' (10 GB), 'byo' (BYO B2 koblet)
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid', 'byo')),
  -- Quota i bytes; NULL = ubegrenset (kun for 'byo')
  quota_bytes BIGINT DEFAULT 1073741824,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Running consumption-ledger per bruker
CREATE TABLE IF NOT EXISTS role_room_user_storage_consumption (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  used_bytes BIGINT NOT NULL DEFAULT 0,
  file_count INTEGER NOT NULL DEFAULT 0,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Notater fra siste reconciliation hvis DB og B2 sprikker
  reconcile_notes TEXT,
  reconciled_at TIMESTAMPTZ
);

-- Per-fil tracking — gir oss UI-listen + sletting + signed URLs
CREATE TABLE IF NOT EXISTS role_room_user_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Object-key i B2 (inkluderer bucket_prefix); UNIQUE for å hindre duplikater
  b2_key TEXT NOT NULL UNIQUE,
  -- Brukerens display-navn — kan være ulik den faktiske b2_key
  display_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  content_type TEXT,
  -- Hvor i appen filen kommer fra (selftape, deck, casting-poster, audio, etc)
  source_module TEXT,
  -- Fritekst-metadata fra source-modulet (audition_id, role_id, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Hvis brukeren har slettet i UI men vi ennå ikke har fjernet fra B2
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_role_room_user_files_user
  ON role_room_user_files(user_id, uploaded_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_role_room_user_files_pending_delete
  ON role_room_user_files(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_room_user_files_source
  ON role_room_user_files(user_id, source_module);

-- ---------------------------------------------------------------------
-- Helper-funksjon: registrer en upload + bump consumption atomisk
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION role_room_register_user_upload(
  p_user_id VARCHAR,
  p_b2_key TEXT,
  p_display_name TEXT,
  p_size_bytes BIGINT,
  p_content_type TEXT,
  p_source_module TEXT,
  p_metadata JSONB
) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE
  v_file_id UUID;
BEGIN
  INSERT INTO role_room_user_files (
    user_id, b2_key, display_name, size_bytes, content_type, source_module, metadata
  )
  VALUES (
    p_user_id, p_b2_key, p_display_name, p_size_bytes, p_content_type,
    p_source_module, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_file_id;

  INSERT INTO role_room_user_storage_consumption (user_id, used_bytes, file_count, last_calculated_at)
  VALUES (p_user_id, p_size_bytes, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    used_bytes = role_room_user_storage_consumption.used_bytes + p_size_bytes,
    file_count = role_room_user_storage_consumption.file_count + 1,
    last_calculated_at = NOW();

  RETURN v_file_id;
END;
$$;

-- ---------------------------------------------------------------------
-- Helper-funksjon: marker fil som slettet + dekrement consumption
-- (Faktisk B2-delete skjer i background-worker som leser deleted_at-rader)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION role_room_mark_user_file_deleted(
  p_user_id VARCHAR,
  p_file_id UUID
) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
  v_size BIGINT;
BEGIN
  UPDATE role_room_user_files
  SET deleted_at = NOW()
  WHERE id = p_file_id AND user_id = p_user_id AND deleted_at IS NULL
  RETURNING size_bytes INTO v_size;

  IF v_size IS NULL THEN
    RETURN 0;
  END IF;

  UPDATE role_room_user_storage_consumption
  SET used_bytes = GREATEST(0, used_bytes - v_size),
      file_count = GREATEST(0, file_count - 1),
      last_calculated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_size;
END;
$$;

COMMIT;
