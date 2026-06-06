-- Migration 231: cloud-backup-destinasjoner (Backblaze B2 først)
--
-- Utvider dit_destinations med felter som beskriver en cloud-bucket
-- + krypterte credentials. storage_type='b2' utløser den nye
-- code-pathen i One Desk's copy_engine (b2_uploader.rs).
--
-- Sikkerhet: cloud_application_key_encrypted lagres som ciphertext
-- (AES-256-GCM med ROLE_ROOM_GOOGLE_TOKEN_ENCRYPTION_KEY eller
-- CREATORHUB_GOOGLE_TOKEN_ENCRYPTION_KEY — samme keyringen som
-- dagens google-token-encryption). Aldri returnert som plaintext
-- til frontend; kun til Bearer-helper-token-eier i One Desk.

ALTER TABLE dit_destinations
  ADD COLUMN IF NOT EXISTS cloud_provider varchar(32),
  ADD COLUMN IF NOT EXISTS cloud_bucket text,
  ADD COLUMN IF NOT EXISTS cloud_bucket_id varchar(64),
  ADD COLUMN IF NOT EXISTS cloud_key_id varchar(64),
  ADD COLUMN IF NOT EXISTS cloud_application_key_encrypted text,
  ADD COLUMN IF NOT EXISTS cloud_prefix text;

CREATE INDEX IF NOT EXISTS dit_destinations_cloud_provider_idx
  ON dit_destinations (cloud_provider)
  WHERE cloud_provider IS NOT NULL;

COMMENT ON COLUMN dit_destinations.cloud_provider IS
  'NULL = lokal destinasjon (path-feltet er filsystem). ''b2'' = Backblaze B2 (cloud_bucket + cloud_key_id påkrevd).';
COMMENT ON COLUMN dit_destinations.cloud_application_key_encrypted IS
  'AES-256-GCM-kryptert B2 application key. Aldri returnert som plaintext til frontend.';
