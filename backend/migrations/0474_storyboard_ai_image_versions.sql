-- Immutable source and candidate versions for the native Storyboard Room
-- Pencil -> AI Color -> AI Atmosphere -> Animation workflow.
CREATE TABLE IF NOT EXISTS storyboard_ai_image_versions (
  id UUID PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  storyboard_id UUID NOT NULL REFERENCES casting_storyboards(id) ON DELETE CASCADE,
  stage VARCHAR(24) NOT NULL CHECK (stage IN ('pencil', 'color', 'atmosphere')),
  parent_version_id UUID REFERENCES storyboard_ai_image_versions(id) ON DELETE SET NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'generated'
    CHECK (status IN ('source', 'generated', 'approved', 'stale')),
  source_fingerprint VARCHAR(64) NOT NULL,
  compilation_fingerprint VARCHAR(64),
  image_data TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  model VARCHAR(100),
  quality VARCHAR(30),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ
);

-- A rolling application instance can create this table before the migration.
-- Re-apply the invariants explicitly so CREATE TABLE IF NOT EXISTS converges.
ALTER TABLE storyboard_ai_image_versions
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_versions_stage_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_versions_status_check,
  DROP CONSTRAINT IF EXISTS storyboard_ai_image_versions_parent_version_id_fkey;

ALTER TABLE storyboard_ai_image_versions
  ADD CONSTRAINT storyboard_ai_image_versions_stage_check
    CHECK (stage IN ('pencil', 'color', 'atmosphere')),
  ADD CONSTRAINT storyboard_ai_image_versions_status_check
    CHECK (status IN ('source', 'generated', 'approved', 'stale')),
  ADD CONSTRAINT storyboard_ai_image_versions_parent_version_id_fkey
    FOREIGN KEY (parent_version_id)
    REFERENCES storyboard_ai_image_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS storyboard_ai_image_versions_storyboard_idx
  ON storyboard_ai_image_versions (storyboard_id, created_at DESC);
CREATE INDEX IF NOT EXISTS storyboard_ai_image_versions_stage_idx
  ON storyboard_ai_image_versions (storyboard_id, stage, created_at DESC);
CREATE INDEX IF NOT EXISTS storyboard_ai_image_versions_parent_idx
  ON storyboard_ai_image_versions (parent_version_id)
  WHERE parent_version_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS storyboard_ai_image_versions_approved_idx
  ON storyboard_ai_image_versions (storyboard_id, stage)
  WHERE status = 'approved';
