-- Photo Room organization and immutable delivery receipts.
-- Assets remain single master objects in CreatorHub S3. Collections only
-- store logical references and never duplicate object bytes.

CREATE TABLE IF NOT EXISTS asset_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL,
  master_id uuid NOT NULL,
  master_kind varchar(20) NOT NULL DEFAULT 'capture',
  collection varchar(80) NOT NULL,
  label varchar(120),
  created_by varchar(64),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_refs_master_kind_check CHECK (master_kind IN ('capture')),
  CONSTRAINT asset_refs_collection_length_check CHECK (char_length(trim(collection)) BETWEEN 1 AND 80)
);

DO $$ BEGIN
  ALTER TABLE asset_refs
    ADD CONSTRAINT asset_refs_master_kind_check CHECK (master_kind IN ('capture')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_refs
    ADD CONSTRAINT asset_refs_collection_length_check
    CHECK (char_length(trim(collection)) BETWEEN 1 AND 80) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_refs
    ADD CONSTRAINT asset_refs_project_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE asset_refs
    ADD CONSTRAINT asset_refs_capture_master_fk
    FOREIGN KEY (master_id) REFERENCES capture_assets(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ar_project_collection
  ON asset_refs(project_id, collection, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ar_dedupe
  ON asset_refs(project_id, master_id, collection);

CREATE TABLE IF NOT EXISTS project_photo_delivery_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  gallery_id uuid NOT NULL REFERENCES photographer_client_galleries(id) ON DELETE CASCADE,
  proofing_round integer NOT NULL DEFAULT 1 CHECK (proofing_round > 0),
  client_name varchar(200) NOT NULL,
  client_email varchar(320) NOT NULL,
  notify_client boolean NOT NULL DEFAULT true,
  email_sent boolean NOT NULL DEFAULT false,
  asset_count integer NOT NULL DEFAULT 0 CHECK (asset_count >= 0),
  created_by varchar,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_photo_delivery_rounds_project_idx
  ON project_photo_delivery_rounds(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_photo_delivery_rounds_gallery_idx
  ON project_photo_delivery_rounds(gallery_id, proofing_round DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS project_photo_delivery_assets (
  delivery_id uuid NOT NULL REFERENCES project_photo_delivery_rounds(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES capture_assets(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (delivery_id, asset_id)
);

CREATE INDEX IF NOT EXISTS project_photo_delivery_assets_asset_idx
  ON project_photo_delivery_assets(asset_id, created_at DESC);
