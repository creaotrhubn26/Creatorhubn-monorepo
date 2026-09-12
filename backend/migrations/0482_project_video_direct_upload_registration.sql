-- Project Video Room: metadata for server-registered direct B2 uploads.
-- The route retains lazy ALTERs for installations where this table is created
-- on first use, while production deployments receive the columns up front.

BEGIN;

ALTER TABLE IF EXISTS project_video_versions
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS upload_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_version_id text;

COMMIT;
