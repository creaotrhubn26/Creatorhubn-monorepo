-- migration-role: creatorhub_migrator
-- 0510: End-to-end dataflow for live research drafts, feed mockup variants,
-- ordered carousel/reel outputs and durable user-file references.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
SELECT pg_advisory_xact_lock(hashtext('0510_role_room_live_feed_mockup_dataflow'));

CREATE TABLE IF NOT EXISTS role_room_feed_mockup_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
  feed_post_id TEXT NOT NULL CHECK (length(feed_post_id) BETWEEN 1 AND 255),
  variant_key VARCHAR(80) NOT NULL CHECK (length(variant_key) BETWEEN 1 AND 80),
  label VARCHAR(160) NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'carousel', 'reel')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  source_research_id UUID,
  input_fingerprint VARCHAR(64),
  quality_status TEXT NOT NULL DEFAULT 'limited'
    CHECK (quality_status IN ('ready', 'limited', 'failed')),
  brand_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  skill_runs JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(skill_runs) = 'array'),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_room_feed_mockup_variants_key_unique
    UNIQUE (workspace_project_id, platform, feed_post_id, variant_key)
);

CREATE UNIQUE INDEX IF NOT EXISTS role_room_feed_mockup_variants_active_unique
  ON role_room_feed_mockup_variants (workspace_project_id, platform, feed_post_id)
  WHERE is_active;

ALTER TABLE role_room_feed_mockup_links
  ADD COLUMN IF NOT EXISTS variant_id UUID,
  ADD COLUMN IF NOT EXISTS output_position SMALLINT NOT NULL DEFAULT 1
    CHECK (output_position BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'not_sent'
    CHECK (sync_status IN ('building', 'not_sent', 'synced', 'stale', 'error')),
  ADD COLUMN IF NOT EXISTS last_error TEXT;

INSERT INTO role_room_feed_mockup_variants
  (workspace_project_id, platform, feed_post_id, variant_key, label, media_type,
   is_active, created_by_user_id, created_at, updated_at)
SELECT l.workspace_project_id, l.platform, l.feed_post_id,
       'legacy-' || replace(l.id::text, '-', ''),
       left(COALESCE(NULLIF(p.name, ''), 'Eksisterende design'), 160), 'image', false,
       l.created_by_user_id, l.created_at, l.updated_at
  FROM role_room_feed_mockup_links l
  JOIN demo_studio_mockup_projects p
    ON p.id=l.mockup_project_id AND p.created_by=l.mockup_created_by
 WHERE l.variant_id IS NULL
ON CONFLICT (workspace_project_id, platform, feed_post_id, variant_key) DO NOTHING;

UPDATE role_room_feed_mockup_links l
   SET variant_id=v.id
  FROM role_room_feed_mockup_variants v
 WHERE l.variant_id IS NULL
   AND v.workspace_project_id=l.workspace_project_id
   AND v.platform=l.platform
   AND v.feed_post_id=l.feed_post_id
   AND v.variant_key='legacy-' || replace(l.id::text, '-', '');

WITH newest AS (
  SELECT DISTINCT ON (workspace_project_id, platform, feed_post_id) id
    FROM role_room_feed_mockup_variants
   ORDER BY workspace_project_id, platform, feed_post_id, updated_at DESC, id
)
UPDATE role_room_feed_mockup_variants v
   SET is_active=true
  FROM newest n
 WHERE v.id=n.id
   AND NOT EXISTS (
     SELECT 1 FROM role_room_feed_mockup_variants active
      WHERE active.workspace_project_id=v.workspace_project_id
        AND active.platform=v.platform
        AND active.feed_post_id=v.feed_post_id
        AND active.is_active
   );

ALTER TABLE role_room_feed_mockup_links
  ALTER COLUMN variant_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname='role_room_feed_mockup_links_variant_fk'
  ) THEN
    ALTER TABLE role_room_feed_mockup_links
      ADD CONSTRAINT role_room_feed_mockup_links_variant_fk
      FOREIGN KEY (variant_id) REFERENCES role_room_feed_mockup_variants(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS role_room_feed_mockup_links_variant_position_unique
  ON role_room_feed_mockup_links (variant_id, output_position);

CREATE TABLE IF NOT EXISTS role_room_feed_mockup_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES role_room_feed_mockup_links(id) ON DELETE CASCADE,
  mockup_revision INTEGER NOT NULL CHECK (mockup_revision > 0),
  output_position SMALLINT NOT NULL CHECK (output_position BETWEEN 1 AND 10),
  sha256 VARCHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  mime_type VARCHAR(100) NOT NULL,
  file_name VARCHAR(200) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  file_id UUID REFERENCES role_room_user_files(id) ON DELETE SET NULL,
  file_owner_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'ready', 'error')),
  error_message TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_room_feed_mockup_outputs_idempotent
    UNIQUE (link_id, mockup_revision, sha256)
);

CREATE INDEX IF NOT EXISTS role_room_feed_mockup_outputs_link_idx
  ON role_room_feed_mockup_outputs (link_id, created_at DESC);

CREATE TABLE IF NOT EXISTS role_room_research_mockup_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_project_id VARCHAR(255) NOT NULL
    REFERENCES casting_projects(id) ON DELETE CASCADE,
  research_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'linkedin')),
  ordinal SMALLINT NOT NULL CHECK (ordinal BETWEEN 1 AND 12),
  feed_post_id TEXT NOT NULL CHECK (length(feed_post_id) BETWEEN 1 AND 255),
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'carousel', 'reel')),
  status TEXT NOT NULL DEFAULT 'building'
    CHECK (status IN ('building', 'ready', 'failed')),
  stage VARCHAR(80),
  progress SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  title VARCHAR(200) NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  preview_data_url TEXT,
  mockup_project_id TEXT,
  variant_id UUID REFERENCES role_room_feed_mockup_variants(id) ON DELETE SET NULL,
  quality_status TEXT NOT NULL DEFAULT 'limited'
    CHECK (quality_status IN ('ready', 'limited', 'failed')),
  skill_runs JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(skill_runs) = 'array'),
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_room_research_mockup_drafts_unique
    UNIQUE (workspace_project_id, research_id, platform, ordinal)
);

CREATE INDEX IF NOT EXISTS role_room_research_mockup_drafts_lookup_idx
  ON role_room_research_mockup_drafts
    (workspace_project_id, research_id, ordinal);

COMMENT ON TABLE role_room_research_mockup_drafts IS
  'Persisted progressive post mockups emitted while Role Room research runs; finalized rows point to the editable Mockup Studio project and feed variant.';
COMMENT ON TABLE role_room_feed_mockup_outputs IS
  'Deduplicated durable render history. The unique revision/hash tuple prevents repeated sends from creating duplicate stored assets.';

COMMIT;
