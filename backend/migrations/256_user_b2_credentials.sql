-- 256_user_b2_credentials.sql
--
-- Per-bruker Backblaze B2-credentials for CreatorHub-skapere
-- (fotografer/videograf/instruktører/etc.). Brukere kjøper EGEN
-- Backblaze-avtale — vi lagrer bare credentials kryptert sånn at de
-- kan arkivere egne foto/video direkte til sin egen bucket.
--
-- Krypteres med STORAGE_MASTER_KEK_HEX via samme envelope-mønster
-- som file-encryption.ts (AES-256-GCM, per-bruker HKDF-derivasjon).
--
-- Sikkerhet:
--   * key_id_encrypted/app_key_encrypted lagres aldri i klartekst
--   * IV (12 byte) lagres separat for hvert ciphertext
--   * UNIQUE (user_id) — én aktiv credential per bruker (oppdateres
--     in-place ved re-konfigurering)
--   * is_verified flippes til TRUE først etter at en faktisk
--     S3 HeadBucket-call mot brukerens bucket lykkes

CREATE TABLE IF NOT EXISTS user_b2_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
    -- En user kan kun ha ett aktiv B2-credential (kan oppdateres)
  bucket_name TEXT NOT NULL,
    -- Klartext bucket-navn (ikke sensitiv)
  key_id_encrypted TEXT NOT NULL,
    -- AES-256-GCM cipher av Key ID (base64: iv||tag||ciphertext)
  key_id_iv TEXT NOT NULL,
    -- IV brukt til kryptering (lagres separat for revisjon)
  app_key_encrypted TEXT NOT NULL,
  app_key_iv TEXT NOT NULL,
  endpoint_url TEXT,
    -- F.eks. 'https://s3.us-west-001.backblazeb2.com' — optional,
    -- default region brukes hvis NULL
  region TEXT NOT NULL DEFAULT 'us-west-001',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE etter at vi har gjort en test-call mot bucketen
  last_verified_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_b2_credentials_user_idx
  ON user_b2_credentials (user_id);

CREATE INDEX IF NOT EXISTS user_b2_credentials_active_idx
  ON user_b2_credentials (user_id) WHERE is_active = TRUE;
