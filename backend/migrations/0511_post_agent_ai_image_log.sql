-- migration-role: creatorhub_migrator
-- 0511: Canonical audit storage for Post Agent image generation.
-- Replaces request-time DDL and records provider/model without storing inline
-- base64 image payloads in Postgres.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0511_post_agent_ai_image_log'));

CREATE TABLE IF NOT EXISTS post_agent_ai_image_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  provider VARCHAR(32) NOT NULL DEFAULT 'fal',
  model VARCHAR(120) NOT NULL DEFAULT 'black-forest-labs/flux-pro-1.1',
  seed BIGINT,
  asset_file_id UUID REFERENCES role_room_user_files(id) ON DELETE SET NULL,
  visual_audit JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE post_agent_ai_image_log
  ADD COLUMN IF NOT EXISTS provider VARCHAR(32) NOT NULL DEFAULT 'fal',
  ADD COLUMN IF NOT EXISTS model VARCHAR(120) NOT NULL
    DEFAULT 'black-forest-labs/flux-pro-1.1',
  ADD COLUMN IF NOT EXISTS asset_file_id UUID REFERENCES role_room_user_files(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visual_audit JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'post_agent_ai_image_log'::regclass
       AND conname = 'post_agent_ai_image_log_provider_check'
  ) THEN
    ALTER TABLE post_agent_ai_image_log
      ADD CONSTRAINT post_agent_ai_image_log_provider_check
      CHECK (provider IN ('openai', 'fal'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS post_agent_ai_image_log_user_created_idx
  ON post_agent_ai_image_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_agent_ai_image_log_created_idx
  ON post_agent_ai_image_log (created_at);

-- Samme genererte byteinnhold skal bare registreres én gang per bruker og
-- Mockup Studio-prosjekt. Dette gjør retries idempotente uten å krysse
-- prosjektets tilgangsgrense eller legge bildefiler i Postgres.
CREATE UNIQUE INDEX IF NOT EXISTS role_room_user_files_mockup_ai_sha_unique
  ON role_room_user_files (user_id, attached_to_entity_id, (metadata->>'sha256'))
  WHERE deleted_at IS NULL
    AND source_module = 'mockup-studio-ai'
    AND attached_to_entity_type = 'mockup-project'
    AND attached_to_entity_id IS NOT NULL
    AND metadata ? 'sha256';

CREATE INDEX IF NOT EXISTS post_agent_ai_image_log_asset_idx
  ON post_agent_ai_image_log (asset_file_id)
  WHERE asset_file_id IS NOT NULL;

COMMENT ON TABLE post_agent_ai_image_log IS
  '90-day audit trail for entitlement-gated Post Agent image generations. Inline image bytes are represented by a SHA-256 fingerprint, not persisted here.';
COMMENT ON COLUMN post_agent_ai_image_log.image_url IS
  'Provider URL or inline:<model>:<sha256> fingerprint; never a full data URL.';
COMMENT ON COLUMN post_agent_ai_image_log.visual_audit IS
  'Structured semantic quality audit for anatomy, hands, symmetry, collisions, isolation, brand harmony and continuity.';

COMMIT;
