-- Photo Room becomes a project-scoped review system shared with Capture and
-- the client gallery. Runtime code must not create or mutate this schema.

CREATE TABLE IF NOT EXISTS project_media_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_media_folders_project_order_idx
  ON project_media_folders(project_id, order_index, name);
ALTER TABLE capture_assets ADD COLUMN IF NOT EXISTS folder_id uuid;
DO $$ BEGIN
  ALTER TABLE capture_assets
    ADD CONSTRAINT capture_assets_folder_fk
    FOREIGN KEY (folder_id) REFERENCES project_media_folders(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Link existing Capture-created galleries to their project so comments and
-- selections become visible in Photo Room without duplicating rows.
UPDATE photographer_client_galleries gallery
   SET project_id = session.project_id,
       gallery_settings = COALESCE(gallery.gallery_settings, '{}'::jsonb)
         || jsonb_build_object('projectId', session.project_id)
  FROM capture_sessions session
 WHERE gallery.project_id IS NULL
   AND session.project_id IS NOT NULL
   AND gallery.gallery_settings->>'captureSessionId' = session.id::text;

DO $$ BEGIN
  ALTER TABLE photographer_client_galleries
    ADD CONSTRAINT photographer_client_galleries_project_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS photographer_client_galleries_project_status_idx
  ON photographer_client_galleries(project_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS client_gallery_images_capture_asset_idx
  ON client_gallery_images(gallery_id, (image_metadata->>'captureAssetId'))
  WHERE image_metadata->>'captureAssetId' IS NOT NULL;

-- Revision rounds belong to the schema, not request-time DDL. Existing
-- selections remain round 1 and future rounds can coexist per image/client.
ALTER TABLE client_image_selections
  ADD COLUMN IF NOT EXISTS proofing_round integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS client_image_selections_round_idx
  ON client_image_selections(gallery_id, proofing_round, updated_at DESC);

DO $$ BEGIN
  IF to_regclass('public.project_board_tasks') IS NOT NULL THEN
    ALTER TABLE project_board_tasks ADD COLUMN IF NOT EXISTS source_kind text;
    ALTER TABLE project_board_tasks ADD COLUMN IF NOT EXISTS source_id uuid;
    CREATE UNIQUE INDEX IF NOT EXISTS project_board_tasks_photo_source_unique
      ON project_board_tasks(project_id, source_kind, source_id)
      WHERE source_id IS NOT NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS project_photo_review (
  asset_id uuid PRIMARY KEY REFERENCES capture_assets(id) ON DELETE CASCADE,
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  review_status text,
  updated_by varchar,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_photo_review_status_check
    CHECK (review_status IS NULL OR review_status IN ('approved', 'needs_edit', 'rejected', 'flagged'))
);

-- Repair tables created by the former lazy runtime schema before tightening
-- their types and constraints. Project ids are UUID-shaped varchar values in
-- public.projects, while the old lazy table incorrectly declared uuid.
DO $$ BEGIN
  IF (SELECT data_type='uuid' FROM information_schema.columns
       WHERE table_schema='public' AND table_name='project_photo_review' AND column_name='project_id') THEN
    ALTER TABLE project_photo_review ALTER COLUMN project_id TYPE varchar USING project_id::text;
  END IF;
END $$;

UPDATE project_photo_review
   SET review_status = NULL
 WHERE review_status IS NOT NULL
   AND review_status NOT IN ('approved', 'needs_edit', 'rejected', 'flagged');

DO $$ BEGIN
  ALTER TABLE project_photo_review
    ADD CONSTRAINT project_photo_review_project_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_photo_review
    ADD CONSTRAINT project_photo_review_asset_fk
    FOREIGN KEY (asset_id) REFERENCES capture_assets(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE project_photo_review
    ADD CONSTRAINT project_photo_review_status_check
    CHECK (review_status IS NULL OR review_status IN ('approved', 'needs_edit', 'rejected', 'flagged'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS project_photo_review_project_status_idx
  ON project_photo_review(project_id, review_status, updated_at DESC);

-- Convert legacy Capture culling flags into the canonical review row once.
INSERT INTO project_photo_review(asset_id, project_id, review_status, updated_at)
SELECT asset.id,
       session.project_id,
       CASE WHEN asset.rejected THEN 'rejected' ELSE 'flagged' END,
       now()
  FROM capture_assets asset
  JOIN capture_sessions session ON session.id = asset.session_id
 WHERE session.project_id IS NOT NULL
   AND (asset.rejected OR asset.flagged_for_client)
ON CONFLICT (asset_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS project_photo_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id varchar NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES capture_assets(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'internal',
  author_name text,
  author_user_id varchar,
  author_kind text NOT NULL DEFAULT 'creator',
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  tag text,
  pinned boolean NOT NULL DEFAULT false,
  parent_id uuid REFERENCES project_photo_comments(id) ON DELETE CASCADE,
  like_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT project_photo_comments_scope_check CHECK (scope IN ('internal', 'client')),
  CONSTRAINT project_photo_comments_author_kind_check CHECK (author_kind IN ('creator', 'client', 'system')),
  CONSTRAINT project_photo_comments_status_check CHECK (status IN ('open', 'resolved')),
  CONSTRAINT project_photo_comments_length_check CHECK (char_length(comment) BETWEEN 1 AND 4000)
);

DO $$ BEGIN
  IF (SELECT data_type='uuid' FROM information_schema.columns
       WHERE table_schema='public' AND table_name='project_photo_comments' AND column_name='project_id') THEN
    ALTER TABLE project_photo_comments ALTER COLUMN project_id TYPE varchar USING project_id::text;
  END IF;
END $$;
ALTER TABLE project_photo_comments ADD COLUMN IF NOT EXISTS author_user_id varchar;
ALTER TABLE project_photo_comments ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE project_photo_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE project_photo_comments SET scope = 'internal' WHERE scope IS NULL OR scope NOT IN ('internal', 'client');
UPDATE project_photo_comments SET author_kind = 'creator' WHERE author_kind IS NULL OR author_kind NOT IN ('creator', 'client', 'system');
UPDATE project_photo_comments SET status = 'open' WHERE status IS NULL OR status NOT IN ('open', 'resolved');
UPDATE project_photo_comments SET pinned = false WHERE pinned IS NULL;
UPDATE project_photo_comments SET like_count = 0 WHERE like_count IS NULL;
ALTER TABLE project_photo_comments ALTER COLUMN scope SET NOT NULL;
ALTER TABLE project_photo_comments ALTER COLUMN author_kind SET NOT NULL;
ALTER TABLE project_photo_comments ALTER COLUMN status SET NOT NULL;
ALTER TABLE project_photo_comments ALTER COLUMN pinned SET NOT NULL;
ALTER TABLE project_photo_comments ALTER COLUMN like_count SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE project_photo_comments
    ADD CONSTRAINT project_photo_comments_project_fk
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments
    ADD CONSTRAINT project_photo_comments_asset_fk
    FOREIGN KEY (asset_id) REFERENCES capture_assets(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments
    ADD CONSTRAINT project_photo_comments_parent_fk
    FOREIGN KEY (parent_id) REFERENCES project_photo_comments(id) ON DELETE CASCADE NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments ADD CONSTRAINT project_photo_comments_scope_check CHECK (scope IN ('internal', 'client'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments ADD CONSTRAINT project_photo_comments_author_kind_check CHECK (author_kind IN ('creator', 'client', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments ADD CONSTRAINT project_photo_comments_status_check CHECK (status IN ('open', 'resolved'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments ADD CONSTRAINT project_photo_comments_asset_required_check
    CHECK (asset_id IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE project_photo_comments ADD CONSTRAINT project_photo_comments_length_check
    CHECK (char_length(comment) BETWEEN 1 AND 4000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS project_photo_comments_asset_created_idx
  ON project_photo_comments(project_id, asset_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_photo_comments_parent_idx
  ON project_photo_comments(parent_id, created_at)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS project_photo_comments_scope_status_idx
  ON project_photo_comments(project_id, scope, status)
  WHERE deleted_at IS NULL;

-- Move the former lazy AI history schema into migrations as well. Keep old
-- B2 columns for read compatibility, but identify all new output explicitly.
CREATE TABLE IF NOT EXISTS generative_ai_jobs (
  id uuid PRIMARY KEY,
  project_id varchar NOT NULL,
  user_id varchar,
  user_email varchar,
  model varchar,
  kind varchar,
  status varchar DEFAULT 'queued',
  provider varchar,
  fal_request_id varchar,
  response_url text,
  input jsonb,
  source_asset_id uuid,
  output_b2_key text,
  output_url_temp text,
  est_cost_usd numeric DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
DO $$ BEGIN
  IF (SELECT data_type='uuid' FROM information_schema.columns
       WHERE table_schema='public' AND table_name='generative_ai_jobs' AND column_name='project_id') THEN
    ALTER TABLE generative_ai_jobs ALTER COLUMN project_id TYPE varchar USING project_id::text;
  END IF;
END $$;
ALTER TABLE generative_ai_jobs ADD COLUMN IF NOT EXISTS output_storage_provider text;
ALTER TABLE generative_ai_jobs ADD COLUMN IF NOT EXISTS output_storage_key text;
DO $$ BEGIN
  ALTER TABLE generative_ai_jobs
    ADD CONSTRAINT generative_ai_jobs_output_storage_provider_check
    CHECK (output_storage_provider IS NULL OR output_storage_provider IN ('creatorhub_s3', 'legacy_role_room_b2', 'temporary'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS generative_ai_jobs_project_photo_history_idx
  ON generative_ai_jobs(project_id, created_at DESC)
  WHERE kind IN ('image-edit', 'image-to-video');

CREATE TABLE IF NOT EXISTS project_ai_consent (
  project_id varchar PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  consented boolean NOT NULL DEFAULT false,
  consented_by varchar,
  consented_at timestamptz
);

-- One authoritative review status. Legacy Capture booleans are mirrors only.
CREATE OR REPLACE FUNCTION sync_capture_asset_photo_review_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE capture_assets
     SET rejected = COALESCE(NEW.review_status = 'rejected', false),
         flagged_for_client = COALESCE(NEW.review_status IN ('approved', 'flagged'), false),
         updated_at = now()
   WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_photo_review_sync_capture ON project_photo_review;
CREATE TRIGGER project_photo_review_sync_capture
AFTER INSERT OR UPDATE OF review_status ON project_photo_review
FOR EACH ROW EXECUTE FUNCTION sync_capture_asset_photo_review_status();

-- Capture remains an editing surface for photographer picks. Convert those
-- legacy booleans back into the canonical row whenever Capture changes them.
-- Updates initiated by the trigger above are skipped by depth, preventing a
-- two-way trigger loop.
CREATE OR REPLACE FUNCTION sync_project_photo_review_from_capture_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  review_project_id varchar;
  review_user_id varchar;
  next_status text;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  SELECT session.project_id, session.owner_user_id
    INTO review_project_id, review_user_id
    FROM capture_sessions session
   WHERE session.id = NEW.session_id;
  IF review_project_id IS NULL THEN
    RETURN NEW;
  END IF;
  next_status := CASE
    WHEN NEW.rejected IS TRUE THEN 'rejected'
    WHEN NEW.flagged_for_client IS TRUE THEN 'flagged'
    ELSE NULL
  END;
  INSERT INTO project_photo_review(asset_id, project_id, review_status, updated_by, updated_at)
  VALUES(NEW.id, review_project_id, next_status, review_user_id, now())
  ON CONFLICT(asset_id) DO UPDATE
    SET project_id=EXCLUDED.project_id,
        review_status=EXCLUDED.review_status,
        updated_by=EXCLUDED.updated_by,
        updated_at=now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_asset_sync_project_photo_review ON capture_assets;
CREATE TRIGGER capture_asset_sync_project_photo_review
AFTER UPDATE OF rejected, flagged_for_client ON capture_assets
FOR EACH ROW EXECUTE FUNCTION sync_project_photo_review_from_capture_status();
