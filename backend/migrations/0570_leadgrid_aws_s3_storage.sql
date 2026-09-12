-- 0570: Leadgrid-owned AWS S3 metadata and organization usage accounting.
--
-- PostgreSQL is authoritative for ownership and display metadata. S3 keys are
-- opaque and never used as an authorization boundary. Existing B2-backed rows
-- remain readable during migration; every new organization-owned upload uses
-- the dedicated AWS_LEADGRID_* runtime identity.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';

CREATE TABLE IF NOT EXISTS leadgrid_storage_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  project_id TEXT,
  uploaded_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  storage_provider TEXT NOT NULL
    CHECK (storage_provider IN ('aws_s3', 'legacy_b2')),
  bucket_name TEXT,
  object_key TEXT NOT NULL,
  purpose TEXT NOT NULL,
  display_name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  content_type TEXT,
  checksum_sha256 CHAR(64)
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT leadgrid_storage_objects_project_fk
    FOREIGN KEY (organization_id, project_id)
    REFERENCES leadgrid_projects(organization_id, id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT leadgrid_storage_objects_provider_key_unique
    UNIQUE (storage_provider, object_key),
  CONSTRAINT leadgrid_storage_objects_aws_contract CHECK (
    storage_provider <> 'aws_s3'
    OR (
      bucket_name IS NOT NULL
      AND bucket_name = 'leadgrid-prod-745600963362-eu-north-1'
      AND checksum_sha256 IS NOT NULL
      AND object_key LIKE 'organizations/%'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_leadgrid_storage_objects_org_active
  ON leadgrid_storage_objects (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_leadgrid_storage_objects_project_active
  ON leadgrid_storage_objects
    (organization_id, project_id, purpose, created_at DESC)
  WHERE deleted_at IS NULL AND project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leadgrid_org_storage_usage (
  organization_id UUID PRIMARY KEY
    REFERENCES organizations(id) ON DELETE RESTRICT,
  used_bytes BIGINT NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  file_count BIGINT NOT NULL DEFAULT 0 CHECK (file_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Make existing Leadgrid attachment IDs valid storage-object IDs before the
-- foreign key is moved away from Role Room's user-owned file ledger.
INSERT INTO leadgrid_storage_objects (
  id, organization_id, project_id, uploaded_by, storage_provider,
  bucket_name, object_key, purpose, display_name, size_bytes,
  content_type, metadata, created_at, deleted_at
)
SELECT attachment.file_id,
       attachment.organization_id,
       attachment.project_id,
       attachment.uploader_user_id,
       'legacy_b2',
       NULL,
       legacy.b2_key,
       'lead_attachment',
       legacy.display_name,
       legacy.size_bytes,
       legacy.content_type,
       COALESCE(legacy.metadata, '{}'::jsonb),
       legacy.uploaded_at,
       legacy.deleted_at
  FROM leadgrid_lead_files attachment
  JOIN role_room_user_files legacy ON legacy.id = attachment.file_id
ON CONFLICT (id) DO NOTHING;

DO $constraints$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT con.conname
    INTO constraint_name
    FROM pg_constraint con
   WHERE con.conrelid = 'leadgrid_lead_files'::regclass
     AND con.contype = 'f'
     AND con.confrelid = 'role_room_user_files'::regclass
   LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE leadgrid_lead_files DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'leadgrid_lead_files'::regclass
       AND conname = 'leadgrid_lead_files_storage_object_fkey'
  ) THEN
    ALTER TABLE leadgrid_lead_files
      ADD CONSTRAINT leadgrid_lead_files_storage_object_fkey
      FOREIGN KEY (file_id)
      REFERENCES leadgrid_storage_objects(id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$constraints$;

ALTER TABLE leadgrid_lead_files
  VALIDATE CONSTRAINT leadgrid_lead_files_storage_object_fkey;

-- Provider markers preserve old B2 objects while new uploads switch to AWS.
ALTER TABLE pitch_deck_assets
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'legacy_b2'
    CHECK (storage_provider IN ('aws_s3', 'legacy_b2')),
  ADD COLUMN IF NOT EXISTS storage_object_id UUID
    REFERENCES leadgrid_storage_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT
    CHECK (size_bytes IS NULL OR size_bytes >= 0),
  ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64)
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$');

-- Migration 0325 documents that this table was originally applied directly
-- with psql, so reproducible/fresh environments need the actual base schema.
CREATE TABLE IF NOT EXISTS partner_application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL
    REFERENCES partner_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  filename TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  mime_type TEXT,
  uploaded_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
  verification_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_partner_application_documents_application
  ON partner_application_documents (application_id, uploaded_at DESC);

ALTER TABLE partner_application_documents
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'legacy_b2'
    CHECK (storage_provider IN ('aws_s3', 'legacy_b2')),
  ADD COLUMN IF NOT EXISTS storage_object_id UUID
    REFERENCES leadgrid_storage_objects(id) ON DELETE SET NULL;

ALTER TABLE leadgrid_canvas_dokumenter
  ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'database'
    CHECK (storage_provider IN ('database', 'aws_s3')),
  ADD COLUMN IF NOT EXISTS storage_object_id UUID
    REFERENCES leadgrid_storage_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT
    CHECK (size_bytes IS NULL OR size_bytes >= 0),
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS checksum_sha256 CHAR(64)
    CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE leadgrid_academy_chapters
  ADD COLUMN IF NOT EXISTS video_storage_provider TEXT NOT NULL DEFAULT 'legacy_b2'
    CHECK (video_storage_provider IN ('aws_s3', 'legacy_b2')),
  ADD COLUMN IF NOT EXISTS video_storage_object_id UUID
    REFERENCES leadgrid_storage_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_size_bytes BIGINT
    CHECK (video_size_bytes IS NULL OR video_size_bytes >= 0),
  ADD COLUMN IF NOT EXISTS video_content_type TEXT,
  ADD COLUMN IF NOT EXISTS video_checksum_sha256 CHAR(64)
    CHECK (video_checksum_sha256 IS NULL OR video_checksum_sha256 ~ '^[0-9a-f]{64}$');

ALTER TABLE sales_prize_catalog
  ADD COLUMN IF NOT EXISTS image_storage_provider TEXT NOT NULL DEFAULT 'external'
    CHECK (image_storage_provider IN ('external', 'aws_s3', 'legacy_b2')),
  ADD COLUMN IF NOT EXISTS image_storage_object_id UUID
    REFERENCES leadgrid_storage_objects(id) ON DELETE SET NULL;

UPDATE sales_prize_catalog
   SET image_storage_provider = 'legacy_b2'
 WHERE image_b2_key IS NOT NULL
   AND image_storage_provider = 'external';

CREATE OR REPLACE FUNCTION leadgrid_bind_prize_storage_object()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  matched_id UUID;
BEGIN
  IF NEW.image_b2_key IS NULL OR NEW.image_b2_key = '' THEN
    NEW.image_storage_provider := 'external';
    NEW.image_storage_object_id := NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO matched_id
    FROM leadgrid_storage_objects
   WHERE organization_id = NEW.organization_id
     AND storage_provider = 'aws_s3'
     AND object_key = NEW.image_b2_key
     AND purpose = 'sales_prize_image'
     AND deleted_at IS NULL
   LIMIT 1;

  IF matched_id IS NOT NULL THEN
    NEW.image_storage_provider := 'aws_s3';
    NEW.image_storage_object_id := matched_id;
    NEW.image_url := NULL;
  ELSE
    NEW.image_storage_provider := 'legacy_b2';
    NEW.image_storage_object_id := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leadgrid_bind_prize_storage_object
  ON sales_prize_catalog;
CREATE TRIGGER trg_leadgrid_bind_prize_storage_object
  BEFORE INSERT OR UPDATE OF organization_id, image_b2_key
  ON sales_prize_catalog
  FOR EACH ROW EXECUTE FUNCTION leadgrid_bind_prize_storage_object();

CREATE INDEX IF NOT EXISTS idx_pitch_deck_assets_storage_object
  ON pitch_deck_assets (storage_object_id)
  WHERE storage_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_partner_documents_storage_object
  ON partner_application_documents (storage_object_id)
  WHERE storage_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_canvas_documents_storage_object
  ON leadgrid_canvas_dokumenter (storage_object_id)
  WHERE storage_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_academy_chapters_storage_object
  ON leadgrid_academy_chapters (video_storage_object_id)
  WHERE video_storage_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_prize_storage_object
  ON sales_prize_catalog (image_storage_object_id)
  WHERE image_storage_object_id IS NOT NULL;

-- Ownership and provider identity are immutable. Moving an object between
-- tenants/providers must create a new row, which also keeps usage deltas exact.
CREATE OR REPLACE FUNCTION leadgrid_reject_storage_identity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.storage_provider IS DISTINCT FROM OLD.storage_provider
     OR NEW.bucket_name IS DISTINCT FROM OLD.bucket_name
     OR NEW.object_key IS DISTINCT FROM OLD.object_key THEN
    RAISE EXCEPTION 'Leadgrid storage object identity is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leadgrid_storage_identity_immutable
  ON leadgrid_storage_objects;
CREATE TRIGGER trg_leadgrid_storage_identity_immutable
  BEFORE UPDATE OF organization_id, storage_provider, bucket_name, object_key
  ON leadgrid_storage_objects
  FOR EACH ROW EXECUTE FUNCTION leadgrid_reject_storage_identity_change();

CREATE OR REPLACE FUNCTION leadgrid_apply_storage_usage_delta()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  old_bytes BIGINT := 0;
  old_files BIGINT := 0;
  new_bytes BIGINT := 0;
  new_files BIGINT := 0;
  target_org UUID;
BEGIN
  IF TG_OP <> 'INSERT'
     AND OLD.storage_provider = 'aws_s3'
     AND OLD.deleted_at IS NULL THEN
    old_bytes := OLD.size_bytes;
    old_files := 1;
    target_org := OLD.organization_id;
  END IF;

  IF TG_OP <> 'DELETE'
     AND NEW.storage_provider = 'aws_s3'
     AND NEW.deleted_at IS NULL THEN
    new_bytes := NEW.size_bytes;
    new_files := 1;
    target_org := NEW.organization_id;
  END IF;

  IF target_org IS NOT NULL THEN
    INSERT INTO leadgrid_org_storage_usage (
      organization_id, used_bytes, file_count, updated_at
    )
    VALUES (
      target_org,
      GREATEST(0, new_bytes - old_bytes),
      GREATEST(0, new_files - old_files),
      NOW()
    )
    ON CONFLICT (organization_id) DO UPDATE SET
      used_bytes = GREATEST(
        0,
        leadgrid_org_storage_usage.used_bytes + new_bytes - old_bytes
      ),
      file_count = GREATEST(
        0,
        leadgrid_org_storage_usage.file_count + new_files - old_files
      ),
      updated_at = NOW();
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leadgrid_storage_usage
  ON leadgrid_storage_objects;
CREATE TRIGGER trg_leadgrid_storage_usage
  AFTER INSERT OR UPDATE OF size_bytes, deleted_at
  OR DELETE ON leadgrid_storage_objects
  FOR EACH ROW EXECUTE FUNCTION leadgrid_apply_storage_usage_delta();

-- Reconcile the snapshot from authoritative active AWS rows. Legacy B2 rows
-- are deliberately excluded until their bytes have actually moved to AWS.
INSERT INTO leadgrid_org_storage_usage (
  organization_id, used_bytes, file_count, updated_at
)
SELECT organization_id,
       COALESCE(SUM(size_bytes), 0),
       COUNT(*),
       NOW()
  FROM leadgrid_storage_objects
 WHERE storage_provider = 'aws_s3'
   AND deleted_at IS NULL
 GROUP BY organization_id
ON CONFLICT (organization_id) DO UPDATE SET
  used_bytes = EXCLUDED.used_bytes,
  file_count = EXCLUDED.file_count,
  updated_at = NOW();

COMMENT ON TABLE leadgrid_storage_objects IS
  'Authoritative organization-owned Leadgrid object metadata; S3 stores bytes only.';
COMMENT ON COLUMN leadgrid_storage_objects.object_key IS
  'Opaque provider key. Never reconstruct from user-provided names and never authorize by prefix alone.';
COMMENT ON TABLE leadgrid_org_storage_usage IS
  'Provider-neutral current usage snapshot for organization-owned Leadgrid AWS objects.';

COMMIT;
