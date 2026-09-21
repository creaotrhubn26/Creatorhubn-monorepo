-- Durable project-level memory-card ingest ledger shared by CaptureApp and
-- WorkspaceShell. This records transfer evidence only; CreatorHub never writes
-- to or deletes source-card media.
CREATE TABLE IF NOT EXISTS capture_card_transfers (
  id uuid PRIMARY KEY,
  owner_user_id varchar NOT NULL,
  project_id varchar NOT NULL,
  card_identifier text NOT NULL,
  card_name text NOT NULL,
  planned_card_label text,
  capacity_bytes bigint,
  available_bytes bigint,
  photo_count integer NOT NULL DEFAULT 0 CHECK (photo_count >= 0),
  video_count integer NOT NULL DEFAULT 0 CHECK (video_count >= 0),
  unsupported_count integer NOT NULL DEFAULT 0 CHECK (unsupported_count >= 0),
  asset_count integer NOT NULL DEFAULT 0 CHECK (asset_count >= 0),
  duplicate_count integer NOT NULL DEFAULT 0 CHECK (duplicate_count >= 0),
  failed_count integer NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  total_bytes bigint NOT NULL DEFAULT 0 CHECK (total_bytes >= 0),
  copied_bytes bigint NOT NULL DEFAULT 0 CHECK (copied_bytes >= 0),
  manifest_sha256 char(64) CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'),
  storage_policy varchar(32) NOT NULL,
  status varchar(32) NOT NULL CHECK (status IN (
    'copying', 'local_verified', 'waiting_for_project', 'uploading',
    'cloud_verified', 'paused', 'failed'
  )),
  local_verified_at timestamptz,
  cloud_verified_at timestamptz,
  source_device text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS capture_card_transfers_project_idx
  ON capture_card_transfers (project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS capture_card_transfers_owner_card_idx
  ON capture_card_transfers (owner_user_id, card_identifier, updated_at DESC);
